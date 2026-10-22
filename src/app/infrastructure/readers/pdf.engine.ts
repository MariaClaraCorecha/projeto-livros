import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import type * as PdfJs from 'pdfjs-dist';
import type { AnnotationAnchor } from '../../domain/entities';
import type {
  AnnotationDecoration,
  ReaderAppearance,
  ReaderEngine,
  ReaderEngineEvents,
  ReaderOpenOptions,
  TocItem,
} from '../../application/ports';
import { loadPdfJs } from '../parsers/pdfjs';
import {
  ANN_CLASS,
  decorate,
  ensureAnnotationStyles,
  flashAnnotation,
  offsetsToRange,
  rangeToOffsets,
  unwrapAnnotations,
  wrapRange,
} from './dom-annotations';

interface PageSlot {
  readonly number: number;
  readonly el: HTMLDivElement;
  rendered: boolean;
  task: RenderTask | null;
  /** Incrementado a cada render/liberação para descartar renderizações obsoletas. */
  generation: number;
}

interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items: OutlineNode[];
}

const PAGE_GAP = 16;

/** PDF: layout fixo. Fontes não se aplicam; papel vira filtro e há zoom. */
export class PdfEngine implements ReaderEngine {
  readonly reflowable = false;

  private pdfjs!: typeof PdfJs;
  private task?: PDFDocumentLoadingTask;
  private doc!: PDFDocumentProxy;
  private host!: HTMLElement;
  private scroller!: HTMLDivElement;
  private slots: PageSlot[] = [];
  private baseSize = { width: 612, height: 792 };
  private scale = 1;
  private current = 1;
  private events!: ReaderEngineEvents;
  private appearance!: ReaderAppearance;
  private decorations: readonly AnnotationDecoration[] = [];
  private observer?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private readonly cleanup: (() => void)[] = [];

  async open(container: HTMLElement, options: ReaderOpenOptions): Promise<void> {
    this.host = container;
    this.events = options.events;
    this.appearance = options.appearance;
    this.decorations = options.decorations;

    this.pdfjs = await loadPdfJs();
    this.task = this.pdfjs.getDocument({ data: new Uint8Array(await options.file.arrayBuffer()) });
    this.doc = await this.task.promise;
    const first = (await this.doc.getPage(1)).getViewport({ scale: 1 });
    this.baseSize = { width: first.width, height: first.height };

    ensureAnnotationStyles(document, options.appearance.iconFont.url);
    this.scroller = document.createElement('div');
    this.scroller.className = 'pdf-scroller';
    container.appendChild(this.scroller);

    for (let n = 1; n <= this.doc.numPages; n++) {
      const el = document.createElement('div');
      el.className = 'pdf-page';
      el.dataset['page'] = String(n);
      this.scroller.appendChild(el);
      this.slots.push({ number: n, el, rendered: false, task: null, generation: 0 });
    }

    this.bindEvents();
    this.current = parsePage(options.location) ?? 1;
    this.layout();
    this.show(this.current);
  }

  async setAppearance(appearance: ReaderAppearance): Promise<void> {
    const relayout =
      appearance.flow !== this.appearance.flow ||
      appearance.pdfZoom !== this.appearance.pdfZoom ||
      appearance.margin !== this.appearance.margin;
    this.appearance = appearance;
    if (relayout) {
      const page = this.current;
      this.layout();
      this.show(page);
    } else {
      this.applyPaper();
    }
  }

  setDecorations(decorations: readonly AnnotationDecoration[]): void {
    this.decorations = decorations;
    for (const slot of this.slots) if (slot.rendered) this.decoratePage(slot);
  }

  next(): void {
    if (this.paginated) this.show(Math.min(this.doc.numPages, this.current + 1));
    else this.scroller.scrollBy({ top: this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  prev(): void {
    if (this.paginated) this.show(Math.max(1, this.current - 1));
    else this.scroller.scrollBy({ top: -this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  async goTo(target: string): Promise<void> {
    const page = parsePage(target);
    if (page) this.show(page);
  }

  async goToAnchor(anchor: AnnotationAnchor): Promise<void> {
    if (anchor.type !== 'text') return;
    this.show(anchor.page);
    const deco = this.decorations.find((d) => d.annotation.anchor === anchor);
    const slot = this.slots[anchor.page - 1];
    if (!deco || !slot) return;
    await this.renderPage(slot);
    const mark = flashAnnotation(slot.el, deco.annotation.id);
    if (!this.paginated) mark?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async goToProgress(fraction: number): Promise<void> {
    this.show(Math.round(fraction * (this.doc.numPages - 1)) + 1);
  }

  async toc(): Promise<TocItem[]> {
    const outline = ((await this.doc.getOutline()) ?? []) as OutlineNode[];
    const resolve = async (items: OutlineNode[]): Promise<TocItem[]> =>
      Promise.all(
        items.map(async (item) => ({
          label: item.title,
          target: `page:${(await this.destinationPage(item.dest)) ?? 1}`,
          children: await resolve(item.items ?? []),
        })),
      );
    return resolve(outline);
  }

  clearSelection(): void {
    document.getSelection()?.removeAllRanges();
  }

  destroy(): void {
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.cleanup.forEach((fn) => fn());
    this.slots.forEach((s) => s.task?.cancel());
    this.scroller?.remove();
    void this.task?.destroy();
  }

  /* ---------------------------------------------------------------- */

  private get paginated(): boolean {
    return this.appearance.flow === 'paginated';
  }

  private layout(): void {
    const { pdfZoom, margin } = this.appearance;
    const availW = Math.max(200, this.host.clientWidth - margin * 2);
    const availH = Math.max(200, this.host.clientHeight - PAGE_GAP * 2);
    const fitWidth = Math.min(availW, 1100) / this.baseSize.width;
    const fitPage = Math.min(availW / this.baseSize.width, availH / this.baseSize.height);
    this.scale = (this.paginated ? fitPage : fitWidth) * pdfZoom;

    this.scroller.classList.toggle('paginated', this.paginated);
    for (const slot of this.slots) {
      this.release(slot);
      slot.el.style.width = `${Math.floor(this.baseSize.width * this.scale)}px`;
      slot.el.style.height = `${Math.floor(this.baseSize.height * this.scale)}px`;
    }
    this.applyPaper();
    this.observe();
  }

  private applyPaper(): void {
    this.scroller.style.setProperty('--pdf-filter', this.appearance.paper.pdfFilter);
  }

  private observe(): void {
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slot = this.slots[Number((entry.target as HTMLElement).dataset['page']) - 1];
          if (entry.isIntersecting) void this.renderPage(slot);
          else this.release(slot);
        }
      },
      { root: this.scroller, rootMargin: '150% 0px' },
    );
    this.slots.forEach((s) => this.observer!.observe(s.el));
  }

  private show(page: number): void {
    this.current = Math.max(1, Math.min(this.doc.numPages, page));
    if (this.paginated) {
      this.slots.forEach((s) => s.el.classList.toggle('active', s.number === this.current));
      void this.renderPage(this.slots[this.current - 1]);
      this.scroller.scrollTop = 0;
    } else {
      this.slots[this.current - 1].el.scrollIntoView({ block: 'start' });
    }
    this.emitLocation();
  }

  private emitLocation(): void {
    const total = this.doc.numPages;
    this.events.relocated({
      location: `page:${this.current}`,
      progress: total > 1 ? (this.current - 1) / (total - 1) : 1,
      label: `Página ${this.current} de ${total}`,
    });
  }

  private async renderPage(slot: PageSlot): Promise<void> {
    if (slot.rendered) return;
    slot.rendered = true;
    const generation = ++slot.generation;
    const page: PDFPageProxy = await this.doc.getPage(slot.number);
    if (generation !== slot.generation) return;
    const viewport = page.getViewport({ scale: this.scale });
    const dpr = window.devicePixelRatio || 1;

    slot.el.style.width = `${Math.floor(viewport.width)}px`;
    slot.el.style.height = `${Math.floor(viewport.height)}px`;
    slot.el.style.setProperty('--total-scale-factor', String(this.scale));

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    slot.el.replaceChildren(canvas, textLayer);

    slot.task = page.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
    try {
      await slot.task.promise;
      const layer = new this.pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textLayer, viewport });
      await layer.render();
      if (generation === slot.generation) this.decoratePage(slot);
    } catch {
      /* renderização cancelada (página saiu da tela ou zoom mudou) */
    } finally {
      slot.task = null;
    }
  }

  private release(slot: PageSlot): void {
    if (!slot.rendered) return;
    slot.task?.cancel();
    slot.generation++;
    slot.rendered = false;
    slot.el.replaceChildren();
  }

  private decoratePage(slot: PageSlot): void {
    const layer = slot.el.querySelector('.textLayer');
    if (!layer) return;
    unwrapAnnotations(layer);
    for (const deco of this.decorations) {
      const a = deco.annotation.anchor;
      if (a.type !== 'text' || a.page !== slot.number) continue;
      const range = offsetsToRange(layer, a.start, a.end);
      if (range) decorate(wrapRange(range, deco.annotation.id), deco);
    }
  }

  private bindEvents(): void {
    const onScroll = () => {
      if (this.paginated) return;
      const mid = this.scroller.scrollTop + this.scroller.clientHeight / 3;
      const slot = this.slots.find((s) => s.el.offsetTop + s.el.offsetHeight > mid);
      if (slot && slot.number !== this.current) {
        this.current = slot.number;
        this.emitLocation();
      }
    };
    const onPointerUp = () => setTimeout(() => this.checkSelection(), 0);
    const onSelectionChange = () => {
      if (document.getSelection()?.isCollapsed) this.events.selected(null);
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest?.(`.${ANN_CLASS}`) as HTMLElement | null;
      const id = el?.dataset['annId'];
      if (id && document.getSelection()?.isCollapsed) this.events.annotationClicked(id);
    };
    this.scroller.addEventListener('scroll', onScroll, { passive: true });
    this.scroller.addEventListener('pointerup', onPointerUp);
    this.scroller.addEventListener('click', onClick);
    document.addEventListener('selectionchange', onSelectionChange);
    this.cleanup.push(() => document.removeEventListener('selectionchange', onSelectionChange));

    let timer: ReturnType<typeof setTimeout> | undefined;
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const page = this.current;
        this.layout();
        this.show(page);
      }, 200);
    });
    this.resizeObserver.observe(this.host);
  }

  private checkSelection(): void {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const pageOf = (n: Node) => (n instanceof Element ? n : n.parentElement)?.closest<HTMLElement>('.pdf-page');
    const page = pageOf(range.startContainer);
    const layer = page?.querySelector('.textLayer');
    if (!page || !layer || !this.scroller.contains(page)) return;

    // Seleções que atravessam páginas são cortadas no fim da primeira página.
    if (pageOf(range.endContainer) !== page) range.setEnd(layer, layer.childNodes.length);
    const quote = range.toString().replace(/\s+/g, ' ').trim();
    if (!quote) return;
    const number = Number(page.dataset['page']);
    const { start, end } = rangeToOffsets(layer, range);
    this.events.selected({
      anchor: { type: 'text', page: number, start, end },
      quote,
      locationLabel: `Página ${number}`,
      sortKey: number * 1e7 + start,
    });
  }

  private async destinationPage(dest: OutlineNode['dest']): Promise<number | null> {
    try {
      const explicit = typeof dest === 'string' ? await this.doc.getDestination(dest) : dest;
      if (!Array.isArray(explicit) || !explicit.length) return null;
      const ref = explicit[0];
      const index =
        typeof ref === 'number' ? ref : await this.doc.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
      return index + 1;
    } catch {
      return null;
    }
  }
}

function parsePage(location: string | null): number | null {
  const m = location && /^page:(\d+)$/.exec(location);
  return m ? Number(m[1]) : null;
}

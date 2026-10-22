import type { AnnotationAnchor } from '../../domain/entities';
import type {
  AnnotationDecoration,
  ReaderAppearance,
  ReaderEngine,
  ReaderEngineEvents,
  ReaderOpenOptions,
  TocItem,
} from '../../application/ports';
import { MobiBook, parseMobi } from '../parsers/mobi-parser';
import {
  ANN_CLASS,
  decorate,
  ensureAnnotationStyles,
  ensureStylesheet,
  flashAnnotation,
  offsetsToRange,
  rangeToOffsets,
  unwrapAnnotations,
  wrapRange,
} from './dom-annotations';

/**
 * MOBI: o HTML extraído é renderizado direto na página. A posição é guardada como
 * deslocamento de caractere (`char:N`), estável mesmo trocando fonte ou tamanho.
 */
export class MobiEngine implements ReaderEngine {
  readonly reflowable = true;

  private mobi!: MobiBook;
  private host!: HTMLElement;
  private scroller!: HTMLDivElement;
  private article!: HTMLElement;
  private events!: ReaderEngineEvents;
  private appearance!: ReaderAppearance;
  private decorations: readonly AnnotationDecoration[] = [];
  private resizeObserver?: ResizeObserver;
  private readonly cleanup: (() => void)[] = [];
  private page = 0;
  private emitTimer?: ReturnType<typeof setTimeout>;

  async open(container: HTMLElement, options: ReaderOpenOptions): Promise<void> {
    this.host = container;
    this.events = options.events;
    this.appearance = options.appearance;
    this.decorations = options.decorations;
    this.mobi = await parseMobi(options.file, { withContent: true });

    ensureAnnotationStyles(document, options.appearance.iconFont.url);
    this.scroller = document.createElement('div');
    this.scroller.className = 'mobi-scroller';
    this.article = document.createElement('article');
    this.article.className = 'mobi-content';
    this.article.innerHTML = this.mobi.html;
    this.scroller.appendChild(this.article);
    container.appendChild(this.scroller);

    this.applyAppearance();
    this.applyDecorations();
    this.bindEvents();
    await this.restore(parseChar(options.location) ?? 0);
  }

  async setAppearance(appearance: ReaderAppearance): Promise<void> {
    const offset = this.visibleOffset();
    this.appearance = appearance;
    this.applyAppearance();
    await this.restore(offset);
  }

  setDecorations(decorations: readonly AnnotationDecoration[]): void {
    this.decorations = decorations;
    this.applyDecorations();
  }

  next(): void {
    if (this.paginated) this.showPage(this.page + 1);
    else this.scroller.scrollBy({ top: this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  prev(): void {
    if (this.paginated) this.showPage(this.page - 1);
    else this.scroller.scrollBy({ top: -this.scroller.clientHeight * 0.9, behavior: 'smooth' });
  }

  async goTo(target: string): Promise<void> {
    const offset = parseChar(target);
    if (offset !== null) await this.restore(offset);
  }

  async goToAnchor(anchor: AnnotationAnchor): Promise<void> {
    if (anchor.type !== 'text') return;
    await this.restore(anchor.start);
    const deco = this.decorations.find((d) => d.annotation.anchor === anchor);
    if (deco) flashAnnotation(this.article, deco.annotation.id);
  }

  async goToProgress(fraction: number): Promise<void> {
    if (this.paginated) {
      this.showPage(Math.round(fraction * (this.pageCount - 1)));
    } else {
      this.scroller.scrollTop = fraction * (this.scroller.scrollHeight - this.scroller.clientHeight);
    }
  }

  /** O MOBI não traz um sumário fácil de mapear: o sumário é montado pelos títulos do texto. */
  async toc(): Promise<TocItem[]> {
    return Array.from(this.article.querySelectorAll<HTMLElement>('h1, h2, h3'))
      .filter((h) => h.textContent?.trim())
      .slice(0, 300)
      .map((h) => {
        const range = document.createRange();
        range.setStart(h, 0);
        return {
          label: h.textContent!.trim().replace(/\s+/g, ' '),
          target: `char:${rangeToOffsets(this.article, range).start}`,
          children: [],
        };
      });
  }

  clearSelection(): void {
    document.getSelection()?.removeAllRanges();
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.cleanup.forEach((fn) => fn());
    clearTimeout(this.emitTimer);
    this.scroller?.remove();
    this.mobi?.dispose();
  }

  /* ---------------------------------------------------------------- */

  private get paginated(): boolean {
    return this.appearance.flow === 'paginated';
  }

  private get pageWidth(): number {
    return this.scroller.clientWidth;
  }

  private get pageCount(): number {
    return Math.max(1, Math.round(this.article.scrollWidth / this.pageWidth));
  }

  private applyAppearance(): void {
    const a = this.appearance;
    if (a.font?.stylesheetUrl) ensureStylesheet(document, a.font.stylesheetUrl);
    this.scroller.classList.toggle('paginated', this.paginated);
    const style = this.article.style;
    style.setProperty('--mobi-margin', `${a.margin}px`);
    style.fontFamily = a.font?.stack ?? 'Georgia, serif';
    style.fontSize = `${(18 * a.fontSize) / 100}px`;
    style.lineHeight = String(a.lineHeight);
    style.textAlign = a.textAlign === 'justify' ? 'justify' : 'start';
    style.color = a.paper.textColor;
    this.article.classList.toggle('dark', a.paper.dark);
    this.updateColumns();
  }

  /** Em modo paginado cada coluna CSS tem exatamente a largura de uma página. */
  private updateColumns(): void {
    this.article.style.columnWidth = this.paginated
      ? `${Math.max(120, this.pageWidth - 2 * this.appearance.margin)}px`
      : '';
  }

  private applyDecorations(): void {
    unwrapAnnotations(this.article);
    for (const deco of this.decorations) {
      const a = deco.annotation.anchor;
      if (a.type !== 'text') continue;
      const range = offsetsToRange(this.article, a.start, a.end);
      if (range) decorate(wrapRange(range, deco.annotation.id), deco);
    }
  }

  private showPage(page: number): void {
    this.page = Math.max(0, Math.min(this.pageCount - 1, page));
    this.scroller.scrollLeft = this.page * this.pageWidth;
    this.emitLocation();
  }

  /** Leva a leitura até o caractere `offset`. */
  private async restore(offset: number): Promise<void> {
    await new Promise(requestAnimationFrame);
    const range = offsetsToRange(this.article, offset, offset + 1);
    const rect = range?.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      this.paginated ? this.showPage(0) : (this.scroller.scrollTop = 0);
      this.emitLocation();
      return;
    }
    const base = this.article.getBoundingClientRect();
    if (this.paginated) {
      // Com colunas CSS, o deslocamento horizontal indica a página.
      this.showPage(Math.floor((rect.left - base.left + 1) / this.pageWidth));
    } else {
      this.scroller.scrollTop = rect.top - base.top - 24;
      this.emitLocation();
    }
  }

  /** Primeiro caractere visível na tela. */
  private visibleOffset(): number {
    const box = this.scroller.getBoundingClientRect();
    const margin = this.appearance.margin;
    const range = caretRange(box.left + margin + 4, box.top + 32);
    if (!range || !this.article.contains(range.startContainer)) return 0;
    return rangeToOffsets(this.article, range).start;
  }

  private emitLocation(): void {
    clearTimeout(this.emitTimer);
    this.emitTimer = setTimeout(() => {
      let progress: number;
      let label: string;
      if (this.paginated) {
        const total = this.pageCount;
        progress = total > 1 ? this.page / (total - 1) : 1;
        label = `Página ${this.page + 1} de ${total}`;
      } else {
        const max = this.scroller.scrollHeight - this.scroller.clientHeight;
        progress = max > 0 ? this.scroller.scrollTop / max : 1;
        label = `${Math.round(progress * 100)}%`;
      }
      this.events.relocated({ location: `char:${this.visibleOffset()}`, progress, label });
    }, 120);
  }

  private bindEvents(): void {
    const onScroll = () => {
      if (!this.paginated) this.emitLocation();
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
    let offset = 0;
    this.resizeObserver = new ResizeObserver(() => {
      if (timer === undefined) offset = this.visibleOffset();
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        this.updateColumns();
        void this.restore(offset);
      }, 200);
    });
    this.resizeObserver.observe(this.host);
  }

  private checkSelection(): void {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!this.article.contains(range.commonAncestorContainer)) return;
    const quote = range.toString().replace(/\s+/g, ' ').trim();
    if (!quote) return;
    const { start, end } = rangeToOffsets(this.article, range);
    const total = this.article.textContent?.length || 1;
    this.events.selected({
      anchor: { type: 'text', page: 0, start, end },
      quote,
      locationLabel: `${Math.round((start / total) * 100)}% do livro`,
      sortKey: start,
    });
  }
}

function parseChar(location: string | null): number | null {
  const m = location && /^char:(\d+)$/.exec(location);
  return m ? Number(m[1]) : null;
}

function caretRange(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    return range;
  }
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

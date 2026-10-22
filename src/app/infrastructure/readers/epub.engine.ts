import ePub from 'epubjs';
import type { AnnotationAnchor } from '../../domain/entities';
import type {
  AnnotationDecoration,
  ReaderAppearance,
  ReaderEngine,
  ReaderEngineEvents,
  ReaderOpenOptions,
  TocItem,
} from '../../application/ports';
import { ANN_CLASS, decorate, ensureAnnotationStyles, ensureStylesheet, flashAnnotation, unwrapAnnotations, wrapRange } from './dom-annotations';

/* Tipos mínimos do epub.js (as definições oficiais estão incompletas). */
interface EpubContents {
  document: Document;
  window: Window;
  cfiBase: string;
  sectionIndex: number;
  range(cfi: string, ignoreClass?: string): Range;
  cfiFromRange(range: Range, ignoreClass?: string): string;
}
interface EpubLocation {
  start: { cfi: string; href: string; index: number; percentage: number };
}
interface EpubNavItem {
  label: string;
  href: string;
  subitems?: EpubNavItem[];
}
interface EpubRendition {
  hooks: { content: { register(fn: (contents: EpubContents) => void): void } };
  display(target?: string | number): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  resize(width?: number, height?: number): void;
  getContents(): EpubContents[];
  currentLocation(): EpubLocation | undefined;
  on(event: string, cb: (...args: never[]) => void): void;
  destroy(): void;
}
interface EpubBook {
  ready: Promise<void>;
  loaded: { navigation: Promise<{ toc: EpubNavItem[] }> };
  spine: { length: number; get(target: string | number): { index: number; href: string } | null };
  locations: {
    generate(chars: number): Promise<string[]>;
    load(json: string): void;
    save(): string;
    length(): number;
    percentageFromCfi(cfi: string): number;
    cfiFromPercentage(p: number): string;
  };
  renderTo(el: HTMLElement, options: Record<string, unknown>): EpubRendition;
  destroy(): void;
}

const STYLE_ID = 'bk-reader-style';

export class EpubEngine implements ReaderEngine {
  readonly reflowable = true;

  private book!: EpubBook;
  private rendition?: EpubRendition;
  private host!: HTMLElement;
  private stage!: HTMLElement;
  private events!: ReaderEngineEvents;
  private appearance!: ReaderAppearance;
  private decorations: readonly AnnotationDecoration[] = [];
  private navItems: EpubNavItem[] = [];
  private locationsReady = false;
  private lastCfi: string | null = null;
  private destroyed = false;

  async open(container: HTMLElement, options: ReaderOpenOptions): Promise<void> {
    this.host = container;
    this.events = options.events;
    this.appearance = options.appearance;
    this.decorations = options.decorations;

    this.book = ePub(await options.file.arrayBuffer()) as unknown as EpubBook;
    await this.book.ready;
    this.navItems = (await this.book.loaded.navigation).toc;

    if (options.cache) {
      try {
        this.book.locations.load(options.cache);
        this.locationsReady = this.book.locations.length() > 0;
      } catch {
        /* cache inválido: gerado de novo abaixo */
      }
    }

    this.stage = document.createElement('div');
    this.stage.className = 'epub-stage';
    container.appendChild(this.stage);
    this.applyHostLayout();
    await this.render(options.location);

    if (!this.locationsReady) void this.generateLocations();
  }

  async setAppearance(appearance: ReaderAppearance): Promise<void> {
    const flowChanged = appearance.flow !== this.appearance.flow;
    const marginChanged = appearance.margin !== this.appearance.margin;
    this.appearance = appearance;
    this.applyHostLayout();
    if (flowChanged) {
      await this.render(this.lastCfi);
      return;
    }
    this.rendition?.getContents().forEach((c) => this.styleContents(c));
    if (marginChanged) this.rendition?.resize();
    // A paginação muda com fonte/tamanho: volta para o mesmo ponto do texto.
    if (this.lastCfi) await this.rendition?.display(this.lastCfi);
  }

  setDecorations(decorations: readonly AnnotationDecoration[]): void {
    this.decorations = decorations;
    this.rendition?.getContents().forEach((c) => {
      unwrapAnnotations(c.document);
      this.decorateContents(c);
    });
  }

  next(): void {
    void this.rendition?.next();
  }

  prev(): void {
    void this.rendition?.prev();
  }

  async goTo(target: string): Promise<void> {
    await this.rendition?.display(target);
  }

  async goToAnchor(anchor: AnnotationAnchor): Promise<void> {
    if (anchor.type !== 'cfi') return;
    await this.rendition?.display(anchor.cfi);
    const id = this.decorations.find((d) => d.annotation.anchor === anchor)?.annotation.id;
    if (id) this.rendition?.getContents().forEach((c) => flashAnnotation(c.document, id));
  }

  async goToProgress(fraction: number): Promise<void> {
    if (this.locationsReady) {
      await this.rendition?.display(this.book.locations.cfiFromPercentage(fraction));
    } else {
      const index = Math.min(this.book.spine.length - 1, Math.floor(fraction * this.book.spine.length));
      await this.rendition?.display(index);
    }
  }

  async toc(): Promise<TocItem[]> {
    const map = (items: EpubNavItem[]): TocItem[] =>
      items.map((i) => ({ label: i.label.trim(), target: i.href, children: map(i.subitems ?? []) }));
    return map(this.navItems);
  }

  clearSelection(): void {
    this.rendition?.getContents().forEach((c) => c.window.getSelection()?.removeAllRanges());
  }

  destroy(): void {
    this.destroyed = true;
    this.rendition?.destroy();
    this.book?.destroy();
    this.stage?.remove();
  }

  /* ---------------------------------------------------------------- */

  private async render(location: string | null): Promise<void> {
    this.rendition?.destroy();
    this.stage.innerHTML = '';
    const paginated = this.appearance.flow === 'paginated';
    const rendition = this.book.renderTo(this.stage, {
      width: '100%',
      height: '100%',
      flow: paginated ? 'paginated' : 'scrolled',
      manager: paginated ? 'default' : 'continuous',
      spread: paginated ? 'auto' : 'none',
      minSpreadWidth: 960,
      ignoreClass: ANN_CLASS,
      allowScriptedContent: false,
    });
    this.rendition = rendition;

    rendition.hooks.content.register((contents) => {
      this.styleContents(contents);
      this.decorateContents(contents);
      this.listen(contents);
    });
    rendition.on('relocated', (location: EpubLocation) => this.onRelocated(location));
    rendition.on('selected', (_cfi: string, contents: EpubContents) => this.onSelected(contents));

    await rendition.display(location ?? undefined).catch(() => rendition.display());
  }

  private applyHostLayout(): void {
    const { margin, paper } = this.appearance;
    Object.assign(this.stage.style, {
      position: 'absolute',
      inset: `16px ${margin}px`,
      color: paper.textColor,
    });
  }

  private styleContents(contents: EpubContents): void {
    const doc = contents.document;
    const a = this.appearance;
    ensureAnnotationStyles(doc, a.iconFont.url);
    if (a.font?.stylesheetUrl) ensureStylesheet(doc, a.font.stylesheetUrl);

    const font = a.font
      ? `body, body *:not(.bk-sticker) { font-family: ${a.font.stack} !important; }`
      : '';
    const css = `
      html, body { background: transparent !important; color: ${a.paper.textColor} !important; }
      body { font-size: ${a.fontSize}% !important; line-height: ${a.lineHeight} !important; }
      body p, body li, body blockquote, body dd, body div { line-height: inherit !important;
        text-align: ${a.textAlign === 'justify' ? 'justify' : 'start'} !important; hyphens: auto; }
      body h1, body h2, body h3, body h4, body h5, body h6 { text-align: center; color: inherit !important; }
      body a { color: ${a.paper.dark ? '#8ab4f8' : '#1a5fb4'} !important; }
      body img, body svg { max-width: 100%; height: auto; }
      ${font}
      ::selection { background: rgba(255, 212, 59, .55); }
    `;
    let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      (doc.head ?? doc.documentElement).appendChild(style);
    }
    style.textContent = css;
  }

  private decorateContents(contents: EpubContents): void {
    const prefix = `epubcfi(${contents.cfiBase}!`;
    for (const deco of this.decorations) {
      const anchor = deco.annotation.anchor;
      if (anchor.type !== 'cfi' || !anchor.cfi.startsWith(prefix)) continue;
      try {
        const range = contents.range(anchor.cfi, ANN_CLASS);
        if (range) decorate(wrapRange(range, deco.annotation.id), deco);
      } catch {
        /* CFI não resolvido nesta versão do conteúdo */
      }
    }
  }

  private listen(contents: EpubContents): void {
    const doc = contents.document;
    doc.addEventListener('click', (e) => {
      const target = (e.target as Element | null)?.closest?.(`.${ANN_CLASS}`) as HTMLElement | null;
      const id = target?.dataset['annId'];
      if (id && doc.getSelection()?.isCollapsed !== false) this.events.annotationClicked(id);
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.next();
      if (e.key === 'ArrowLeft') this.prev();
    });
    // Seleção desfeita (clique fora) → esconde a barra de anotação.
    doc.addEventListener('selectionchange', () => {
      if (doc.getSelection()?.isCollapsed) this.events.selected(null);
    });
  }

  private onSelected(contents: EpubContents): void {
    const selection = contents.window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const quote = range.toString().trim();
    if (!quote) return;
    const cfi = contents.cfiFromRange(range, ANN_CLASS);
    this.events.selected({
      anchor: { type: 'cfi', cfi },
      quote,
      locationLabel: this.chapterLabel(this.book.spine.get(contents.sectionIndex)?.href ?? ''),
      sortKey: this.sortKey(cfi, contents.sectionIndex),
    });
  }

  private onRelocated(location: EpubLocation): void {
    const cfi = location.start.cfi;
    this.lastCfi = cfi;
    this.events.relocated({
      location: cfi,
      progress: this.locationsReady ? this.book.locations.percentageFromCfi(cfi) : location.start.index / this.book.spine.length,
      label: this.chapterLabel(location.start.href),
    });
  }

  private sortKey(cfi: string, sectionIndex: number): number {
    if (this.locationsReady) return this.book.locations.percentageFromCfi(cfi);
    return sectionIndex / Math.max(1, this.book.spine.length);
  }

  private chapterLabel(href: string): string {
    const clean = (h: string) => h.split('#')[0].split('/').pop() ?? h;
    const target = clean(href);
    let found = '';
    const walk = (items: EpubNavItem[]) => {
      for (const item of items) {
        if (!found && clean(item.href) === target) found = item.label.trim();
        walk(item.subitems ?? []);
      }
    };
    walk(this.navItems);
    return found;
  }

  /** Gera a tabela de localizações (necessária para o percentual de leitura) em segundo plano. */
  private async generateLocations(): Promise<void> {
    await this.book.locations.generate(1200);
    if (this.destroyed) return;
    this.locationsReady = true;
    this.events.cacheUpdated(this.book.locations.save());
    const current = this.rendition?.currentLocation();
    if (current?.start) this.onRelocated(current);
  }
}

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
  start: { cfi: string; href: string; index: number; percentage: number; displayed?: { page: number; total: number } };
  atStart?: boolean;
  atEnd?: boolean;
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
  packaging?: { metadata?: { language?: string } };
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
/** Largura máxima da coluna de texto no modo rolagem (linhas longas cansam a leitura). */
const SCROLL_COLUMN = 760;
/** Espaço lateral mínimo para o texto não ficar embaixo das setas de navegação. */
const NAV_SPACE = { wide: 56, narrow: 36 };
/** Duração de cada metade da animação de virar a página (sai / entra), em ms. */
const TURN_MS = 170;
/** Fração da largura em cada lateral que vira a página ao tocar; o meio mostra/esconde os menus. */
const TAP_ZONE = 0.3;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  private language = '';
  private lastWheel = 0;
  private turning = false;
  private destroyed = false;

  async open(container: HTMLElement, options: ReaderOpenOptions): Promise<void> {
    this.host = container;
    this.events = options.events;
    this.appearance = options.appearance;
    this.decorations = options.decorations;

    this.book = ePub(await options.file.arrayBuffer()) as unknown as EpubBook;
    await this.book.ready;
    this.navItems = (await this.book.loaded.navigation).toc;
    this.language = this.book.packaging?.metadata?.language ?? '';

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
    // Rodinha do mouse nas margens (fora do iframe) também vira a página.
    this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
    container.appendChild(this.stage);
    this.applyHostLayout();
    await this.render(options.location);

    if (!this.locationsReady) void this.generateLocations();
  }

  async setAppearance(appearance: ReaderAppearance): Promise<void> {
    const flowChanged = appearance.flow !== this.appearance.flow;
    // Fonte e tamanho mudam a altura das imagens/colunas: o epub.js precisa recalcular o layout.
    const layoutChanged =
      appearance.margin !== this.appearance.margin ||
      appearance.fontSize !== this.appearance.fontSize ||
      appearance.lineHeight !== this.appearance.lineHeight;
    this.appearance = appearance;
    this.applyHostLayout();
    if (flowChanged) {
      await this.render(this.lastCfi);
      return;
    }
    this.rendition?.getContents().forEach((c) => this.styleContents(c));
    if (layoutChanged) this.rendition?.resize();
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
    void this.turn(1);
  }

  prev(): void {
    void this.turn(-1);
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

  private get paginated(): boolean {
    return this.appearance.flow === 'paginated';
  }

  private applyHostLayout(): void {
    const { margin, paper } = this.appearance;
    const side = Math.max(margin, this.host.clientWidth < 600 ? NAV_SPACE.narrow : NAV_SPACE.wide);
    Object.assign(
      this.stage.style,
      { position: 'absolute', color: paper.textColor, margin: '0 auto' },
      this.paginated
        ? // Páginas: área inteira (com duas páginas lado a lado em telas largas).
          { top: '28px', bottom: '20px', left: `${side}px`, right: `${side}px`, width: 'auto' }
        : // Rolagem: coluna centralizada com largura confortável.
          { top: '0', bottom: '0', left: '0', right: '0', width: `min(calc(100% - ${2 * side}px), ${SCROLL_COLUMN}px)` },
    );
  }

  private styleContents(contents: EpubContents): void {
    const doc = contents.document;
    const a = this.appearance;
    // Sem idioma a hifenização automática não funciona.
    if (this.language && !doc.documentElement.lang) doc.documentElement.lang = this.language;
    ensureAnnotationStyles(doc, a.iconFont.url);
    if (a.font?.stylesheetUrl) ensureStylesheet(doc, a.font.stylesheetUrl);

    const font = a.font
      ? `body, body *:not(.bk-sticker) { font-family: ${a.font.stack} !important; }`
      : '';
    // Em papel escuro, cores e fundos fixos do livro (texto preto, caixas brancas) ficariam ilegíveis.
    const dark = a.paper.dark
      ? `body :not(a):not(mark):not(.bk-sticker) { color: inherit !important; background-color: transparent !important;
           border-color: color-mix(in srgb, currentColor 35%, transparent) !important; }
         body img { filter: brightness(.85); }`
      : '';
    // No modo páginas, 1vh dentro do iframe = altura da página: imagens nunca são cortadas entre páginas.
    const paged = this.paginated
      ? `body img, body svg, body video { max-height: 94vh !important; object-fit: contain; }
         body { padding-top: 0 !important; padding-bottom: 0 !important; }`
      : `body { padding-top: 32px !important; padding-bottom: 96px !important; }`;
    const css = `
      html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
      html, body { background: transparent !important; color: ${a.paper.textColor} !important; }
      body { font-size: ${a.fontSize}% !important; line-height: ${a.lineHeight} !important;
        text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; font-kerning: normal; }
      body p, body li, body blockquote, body dd, body div { line-height: inherit !important;
        text-align: ${a.textAlign === 'justify' ? 'justify' : 'start'} !important; hyphens: auto; -webkit-hyphens: auto; }
      body p { orphans: 2; widows: 2; }
      body h1, body h2, body h3, body h4, body h5, body h6 { text-align: center; color: inherit !important; line-height: 1.3 !important;
        hyphens: manual; break-after: avoid; page-break-after: avoid; text-wrap: balance; }
      body a { color: ${a.paper.dark ? '#8ab4f8' : '#1a5fb4'} !important; }
      body img, body svg, body video { max-width: 100% !important; height: auto; }
      body img, body svg, body figure, body table { break-inside: avoid; page-break-inside: avoid; }
      body figure { margin-left: 0; margin-right: 0; }
      body table { max-width: 100%; border-collapse: collapse; }
      body pre { white-space: pre-wrap; overflow-wrap: anywhere; }
      body blockquote { margin-left: 1.2em; margin-right: 1.2em; }
      ${paged}
      ${dark}
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
    let tapTimer: ReturnType<typeof setTimeout> | undefined;
    doc.addEventListener('click', (e) => {
      const el = e.target as Element | null;
      const target = el?.closest?.(`.${ANN_CLASS}`) as HTMLElement | null;
      const id = target?.dataset['annId'];
      if (id && doc.getSelection()?.isCollapsed !== false) {
        this.events.annotationClicked(id);
        return;
      }
      // Zonas de toque do Kindle (só no modo páginas; links e mídia seguem normais).
      clearTimeout(tapTimer);
      if (!this.paginated || e.detail > 1 || el?.closest?.('a, button, input, textarea, select, label, video, audio')) return;
      const x = (contents.window.frameElement?.getBoundingClientRect().left ?? 0) + e.clientX;
      // Espera um instante: um duplo clique (selecionar palavra) não deve virar a página.
      tapTimer = setTimeout(() => {
        if (doc.getSelection()?.isCollapsed !== false) this.onTap(x);
      }, 250);
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') this.next();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') this.prev();
    });
    doc.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });

    // Arrastar o dedo para os lados: a página acompanha o dedo e, ao soltar, vira ou volta ao lugar.
    // Usa `screenX` porque o iframe se move junto com o dedo (o `clientX` dele ficaria parado).
    let touch: { x: number; y: number; t: number; dragging: boolean } | null = null;
    doc.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        touch =
          e.touches.length === 1 && this.paginated && !this.turning
            ? { x: t.screenX, y: t.screenY, t: Date.now(), dragging: false }
            : null;
      },
      { passive: true },
    );
    doc.addEventListener(
      'touchmove',
      (e) => {
        if (!touch) return;
        const dx = e.touches[0].screenX - touch.x;
        const dy = e.touches[0].screenY - touch.y;
        if (!touch.dragging) {
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
          // Gesto vertical ou seleção de texto (toque longo): não é virada de página.
          if (Math.abs(dx) < Math.abs(dy) * 1.2 || doc.getSelection()?.isCollapsed === false) {
            touch = null;
            return;
          }
          touch.dragging = true;
        }
        const here = this.rendition?.currentLocation();
        const atEdge = dx < 0 ? here?.atEnd : here?.atStart;
        // Na primeira/última página o arraste resiste, como um elástico.
        const shown = atEdge ? dx * 0.25 : dx;
        void this.moveStage(shown, 1 - Math.min(0.6, Math.abs(shown) / this.stage.clientWidth), 0);
      },
      { passive: true },
    );
    doc.addEventListener('touchend', (e) => {
      const start = touch;
      touch = null;
      if (!start?.dragging) return;
      const dx = e.changedTouches[0].screenX - start.x;
      const flick = Date.now() - start.t < 300 && Math.abs(dx) > 40;
      if (flick || Math.abs(dx) > this.stage.clientWidth * 0.25) void this.turn(dx < 0 ? 1 : -1, dx);
      else void this.settleStage();
    });
    doc.addEventListener('touchcancel', () => {
      if (touch?.dragging) void this.settleStage();
      touch = null;
    });
    // Seleção desfeita (clique fora) → esconde a barra de anotação.
    doc.addEventListener('selectionchange', () => {
      if (doc.getSelection()?.isCollapsed) this.events.selected(null);
    });
  }

  /**
   * Vira a página como no Kindle: a atual desliza para o lado e some, a próxima entra pelo
   * lado oposto. `dragged` é quanto o dedo já arrastou (a animação continua dali).
   */
  private async turn(dir: 1 | -1, dragged = 0): Promise<void> {
    const rendition = this.rendition;
    if (!rendition || this.turning) return;
    const go = () => (dir > 0 ? rendition.next() : rendition.prev());
    if (!this.paginated || reducedMotion()) {
      this.resetStage();
      await go();
      return;
    }
    const here = rendition.currentLocation();
    if (dir > 0 ? here?.atEnd : here?.atStart) {
      await this.settleStage();
      return;
    }
    this.turning = true;
    const distance = Math.max(this.stage.clientWidth * 0.3, Math.abs(dragged));
    try {
      await this.moveStage(-dir * distance, 0, TURN_MS);
      await go();
      await this.moveStage(dir * this.stage.clientWidth * 0.3, 0, 0);
      await this.moveStage(0, 1, TURN_MS);
    } finally {
      this.resetStage();
      this.turning = false;
    }
  }

  /** Devolve a página ao lugar (arraste curto demais ou na primeira/última página). */
  private async settleStage(): Promise<void> {
    await this.moveStage(0, 1, TURN_MS);
    this.resetStage();
  }

  private moveStage(x: number, opacity: number, ms: number): Promise<void> {
    const s = this.stage.style;
    s.transition = ms ? `transform ${ms}ms ease-out, opacity ${ms}ms ease-out` : 'none';
    s.transform = `translateX(${x}px)`;
    s.opacity = String(opacity);
    if (!ms) {
      void this.stage.offsetWidth; // aplica já, para a próxima transição partir daqui
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resetStage(): void {
    Object.assign(this.stage.style, { transition: '', transform: '', opacity: '' });
  }

  /** Toque na página: laterais viram a página, o meio mostra/esconde os menus. */
  private onTap(x: number): void {
    const rect = this.host.getBoundingClientRect();
    const f = (x - rect.left) / rect.width;
    if (f < TAP_ZONE) this.prev();
    else if (f > 1 - TAP_ZONE) this.next();
    else this.events.centerTapped();
  }

  /** No modo páginas, a rodinha do mouse vira a página (uma por gesto). */
  private onWheel(e: WheelEvent): void {
    if (!this.paginated) return;
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(delta) < 15) return;
    const now = Date.now();
    if (now - this.lastWheel < 450) return;
    this.lastWheel = now;
    if (delta > 0) this.next();
    else this.prev();
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
    const chapter = this.chapterLabel(location.start.href);
    const shown = location.start.displayed;
    const page = this.paginated && shown && shown.total > 1 ? `pág. ${shown.page} de ${shown.total}` : '';
    this.events.relocated({
      location: cfi,
      progress: this.locationsReady ? this.book.locations.percentageFromCfi(cfi) : location.start.index / this.book.spine.length,
      label: [chapter, page].filter(Boolean).join(' · '),
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

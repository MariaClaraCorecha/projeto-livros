import { AnnotationDecoration } from '../../application/ports';
import { highlighterCss } from '../../core/highlighter-style';

/**
 * Utilitários de DOM compartilhados pelos motores de leitura para desenhar
 * marca-textos, comentários e figurinhas diretamente no texto.
 *
 * Os elementos inseridos têm a classe `bk-ann` (ignorada no cálculo de CFI do EPUB) e
 * as figurinhas não têm nós de texto, para não alterar os deslocamentos de caracteres.
 */
export const ANN_CLASS = 'bk-ann';

const STYLE_ID = 'bk-annotation-styles';
const BASE_CSS = `
mark.${ANN_CLASS} { background: transparent; color: inherit; cursor: pointer; border-radius: 2px;
  -webkit-box-decoration-break: clone; box-decoration-break: clone; }
mark.${ANN_CLASS}.bk-active { outline: 2px solid #1c7ed6; outline-offset: 1px; }
span.bk-sticker { display: inline-block; cursor: pointer; vertical-align: super; line-height: 1;
  font-size: .95em; margin: 0 .1em; user-select: none; -webkit-user-select: none; }
span.bk-sticker::after { content: attr(data-content); color: #e8590c; font-style: normal; font-weight: normal;
  font-feature-settings: 'liga'; -webkit-font-feature-settings: 'liga'; text-shadow: none; }
span.bk-sticker.bk-image { width: 1.6em; height: 1.6em; background: center / contain no-repeat; }
span.bk-sticker.bk-image::after { content: none; }
span.bk-sticker:hover { transform: scale(1.25); }
`;

export function ensureAnnotationStyles(doc: Document, iconFontUrl?: string): void {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = BASE_CSS;
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  if (iconFontUrl) ensureStylesheet(doc, iconFontUrl);
}

export function ensureStylesheet(doc: Document, href: string): void {
  if (doc.querySelector(`link[href="${CSS.escape(href)}"]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  (doc.head ?? doc.documentElement).appendChild(link);
}

/** Envolve o texto do intervalo em `<mark>`s (um por nó de texto) e retorna as marcas criadas. */
export function wrapRange(range: Range, annotationId: string): HTMLElement[] {
  const doc = range.startContainer.ownerDocument;
  if (!doc || range.collapsed) return [];

  const root = range.commonAncestorContainer;
  const nodes: Text[] = [];
  if (root.nodeType === Node.TEXT_NODE) {
    nodes.push(root as Text);
  } else {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (range.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  }

  // Os limites são calculados antes de dividir os nós, porque `splitText` mexe no intervalo.
  const slices = nodes
    .map((node) => ({
      node,
      start: node === range.startContainer ? range.startOffset : 0,
      end: node === range.endContainer ? range.endOffset : node.length,
    }))
    .filter((s) => s.end > s.start && s.node.data.slice(s.start, s.end).trim() !== '');

  return slices.map(({ node, start, end }) => {
    if (end < node.length) node.splitText(end);
    const target = start > 0 ? node.splitText(start) : node;
    const mark = doc.createElement('mark');
    mark.className = ANN_CLASS;
    mark.dataset['annId'] = annotationId;
    target.parentNode!.insertBefore(mark, target);
    mark.appendChild(target);
    return mark;
  });
}

/** Remove as marcas e figurinhas (de uma anotação ou todas) restaurando o texto original. */
export function unwrapAnnotations(root: ParentNode, annotationId?: string): void {
  const filter = annotationId ? `[data-ann-id="${CSS.escape(annotationId)}"]` : '';
  root.querySelectorAll(`span.bk-sticker${filter}`).forEach((el) => el.remove());
  const parents = new Set<Node>();
  root.querySelectorAll(`mark.${ANN_CLASS}${filter}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parents.add(parent);
  });
  parents.forEach((p) => p.normalize());
}

/** Aplica o visual da anotação às marcas e insere a figurinha após o trecho. */
export function decorate(marks: HTMLElement[], decoration: AnnotationDecoration): void {
  if (!marks.length) return;
  const { annotation, highlighter, sticker } = decoration;
  const css = highlighterCss(highlighter);
  for (const mark of marks) {
    Object.assign(mark.style, css);
    if (annotation.comment) mark.title = annotation.comment;
  }
  if (!sticker) return;

  const doc = marks[0].ownerDocument;
  const el = doc.createElement('span');
  el.className = `${ANN_CLASS} bk-sticker`;
  el.dataset['annId'] = annotation.id;
  if (annotation.comment) el.title = annotation.comment;
  if (sticker.kind === 'image') {
    el.classList.add('bk-image');
    el.style.backgroundImage = `url("${sticker.url}")`;
  } else {
    el.dataset['content'] = sticker.value;
    if (sticker.kind === 'icon') el.style.fontFamily = `"${sticker.fontFamily}"`;
  }
  marks[marks.length - 1].after(el);
}

/** Marca (visualmente) a anotação selecionada no painel. */
export function flashAnnotation(root: ParentNode, annotationId: string): HTMLElement | null {
  const marks = Array.from(root.querySelectorAll<HTMLElement>(`mark.${ANN_CLASS}[data-ann-id="${CSS.escape(annotationId)}"]`));
  marks.forEach((m) => m.classList.add('bk-active'));
  setTimeout(() => marks.forEach((m) => m.classList.remove('bk-active')), 1600);
  return marks[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Âncoras por deslocamento de texto (PDF e MOBI)                      */
/* ------------------------------------------------------------------ */

export function rangeToOffsets(root: Node, range: Range): { start: number; end: number } {
  const before = root.ownerDocument!.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

export function offsetsToRange(root: Node, start: number, end: number): Range | null {
  const doc = root.ownerDocument!;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  let pos = 0;
  let started = false;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const next = pos + n.length;
    if (!started && start < next) {
      range.setStart(n, start - pos);
      started = true;
    }
    if (started && end <= next) {
      range.setEnd(n, end - pos);
      return range;
    }
    pos = next;
  }
  return null;
}

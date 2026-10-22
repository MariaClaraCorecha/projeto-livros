
import { StickerRef } from './sticker';

/**
 * Âncora de uma anotação dentro do livro.
 * - `cfi`: EPUB (EPUB Canonical Fragment Identifier).
 * - `text`: deslocamento de caracteres dentro de uma página (PDF) ou do documento (MOBI).
 */
export type AnnotationAnchor =
  | { readonly type: 'cfi'; readonly cfi: string }
  | { readonly type: 'text'; readonly page: number; readonly start: number; readonly end: number };

export interface Annotation {
  readonly id: string;
  readonly ownerId: string;
  readonly bookId: string;
  readonly anchor: AnnotationAnchor;
  /** Trecho selecionado. */
  readonly quote: string;
  highlighterId: string | null;
  comment: string;
  sticker: StickerRef | null;
  /** Rótulo legível da posição (capítulo, página…). */
  readonly locationLabel: string;
  /** Usado para ordenar as anotações na ordem de leitura. */
  readonly sortKey: number;
  readonly createdAt: number;
  updatedAt: number;
}

export function anchorKey(anchor: AnnotationAnchor): string {
  return anchor.type === 'cfi' ? anchor.cfi : `${anchor.page}:${anchor.start}-${anchor.end}`;
}

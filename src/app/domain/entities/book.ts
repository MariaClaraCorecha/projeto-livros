export type BookFormat = 'epub' | 'pdf' | 'mobi';

export const SUPPORTED_EXTENSIONS: Record<string, BookFormat> = {
  epub: 'epub',
  pdf: 'pdf',
  mobi: 'mobi',
  azw: 'mobi',
  azw3: 'mobi',
  prc: 'mobi',
};

export interface Book {
  readonly id: string;
  readonly ownerId: string;
  title: string;
  author: string;
  readonly format: BookFormat;
  readonly fileName: string;
  readonly size: number;
  coverDataUrl: string | null;
  /** `null` = livro fora de qualquer estante. */
  shelfId: string | null;
  /** Posição do livro dentro da estante. */
  order: number;
  favorite: boolean;
  /** 0..1 */
  progress: number;
  /** Localização opaca entendida pelo leitor do formato (CFI, página, posição). */
  lastLocation: string | null;
  /** Cache opaco do leitor (ex.: tabela de localizações do EPUB). */
  engineCache: string | null;
  readonly addedAt: number;
  lastOpenedAt: number | null;
}

export interface BookMetadata {
  title: string;
  author: string;
  coverDataUrl: string | null;
}

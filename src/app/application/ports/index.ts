import {
  Annotation,
  AnnotationAnchor,
  BookFormat,
  BookMetadata,
  FontFamily,
  Highlighter,
  Paper,
  ReadingFlow,
  TextAlign,
} from '../../domain/entities';

/* ------------------------------------------------------------------ */
/* Leitura de metadados dos arquivos                                   */
/* ------------------------------------------------------------------ */

export abstract class BookMetadataExtractor {
  /** Detecta o formato pelo conteúdo (assinatura) e, em último caso, pela extensão. */
  abstract detectFormat(file: File): Promise<BookFormat | null>;
  abstract extract(file: File, format: BookFormat): Promise<BookMetadata>;
}

/* ------------------------------------------------------------------ */
/* Fontes                                                              */
/* ------------------------------------------------------------------ */

export abstract class FontLoader {
  /** URL da folha de estilo da fonte (ou `null` para fontes do sistema). */
  abstract stylesheetUrl(font: Pick<FontFamily, 'family' | 'source'>): string | null;
  /** Carrega a fonte no documento principal. Resolve `false` se a família não existir. */
  abstract load(font: Pick<FontFamily, 'family' | 'source'>): Promise<boolean>;
  /** Carrega a fonte de ícones (Material Symbols) no estilo pedido e retorna o nome da família. */
  abstract loadIconFont(style: 'outlined' | 'rounded' | 'sharp'): { family: string; url: string };
}

export abstract class FontCatalog {
  abstract readonly complete: boolean;
  abstract list(): Promise<FontFamily[]>;
}

/* ------------------------------------------------------------------ */
/* Motor de leitura                                                    */
/* ------------------------------------------------------------------ */

export interface ReaderAppearance {
  /** `null` = usar a fonte original do livro. */
  readonly font: { readonly stack: string; readonly stylesheetUrl: string | null } | null;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly margin: number;
  readonly textAlign: TextAlign;
  readonly paper: Paper;
  readonly flow: ReadingFlow;
  readonly pdfZoom: number;
  readonly iconFont: { readonly family: string; readonly url: string };
}

export type ResolvedSticker =
  | { readonly kind: 'emoji'; readonly value: string }
  | { readonly kind: 'icon'; readonly value: string; readonly fontFamily: string }
  | { readonly kind: 'image'; readonly url: string };

export interface AnnotationDecoration {
  readonly annotation: Annotation;
  readonly highlighter: Highlighter | null;
  readonly sticker: ResolvedSticker | null;
}

export interface ReaderLocation {
  readonly location: string;
  /** 0..1 */
  readonly progress: number;
  readonly label: string;
}

export interface ReaderSelection {
  readonly anchor: AnnotationAnchor;
  readonly quote: string;
  readonly locationLabel: string;
  readonly sortKey: number;
}

export interface TocItem {
  readonly label: string;
  readonly target: string;
  readonly children: TocItem[];
}

export interface ReaderEngineEvents {
  relocated(location: ReaderLocation): void;
  selected(selection: ReaderSelection | null): void;
  annotationClicked(annotationId: string): void;
  cacheUpdated(cache: string): void;
  /** Toque no centro da página (estilo Kindle): mostra/esconde os menus. */
  centerTapped(): void;
}

export interface ReaderOpenOptions {
  readonly file: Blob;
  readonly location: string | null;
  readonly cache: string | null;
  readonly appearance: ReaderAppearance;
  readonly decorations: readonly AnnotationDecoration[];
  readonly events: ReaderEngineEvents;
}

export interface ReaderEngine {
  /** Fontes, tamanho e espaçamento são aplicáveis a este formato? (PDF não é.) */
  readonly reflowable: boolean;
  open(container: HTMLElement, options: ReaderOpenOptions): Promise<void>;
  setAppearance(appearance: ReaderAppearance): Promise<void>;
  setDecorations(decorations: readonly AnnotationDecoration[]): void;
  next(): void;
  prev(): void;
  goTo(target: string): Promise<void>;
  goToAnchor(anchor: AnnotationAnchor): Promise<void>;
  goToProgress(fraction: number): Promise<void>;
  toc(): Promise<TocItem[]>;
  clearSelection(): void;
  destroy(): void;
}

export abstract class ReaderEngineFactory {
  abstract create(format: BookFormat): Promise<ReaderEngine>;
}

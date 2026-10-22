import { FontFamily } from './font';
import { Highlighter } from './highlighter';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ReadingFlow = 'paginated' | 'scrolled';
export type TextAlign = 'start' | 'justify';
export type IconStyle = 'outlined' | 'rounded' | 'sharp';

export interface ReaderPreferences {
  readonly ownerId: string;
  themeMode: ThemeMode;
  fontFamily: string;
  /** Percentual (100 = tamanho original). */
  fontSize: number;
  lineHeight: number;
  /** Margem lateral em px. */
  margin: number;
  textAlign: TextAlign;
  paperId: string;
  flow: ReadingFlow;
  /** Zoom das páginas de PDF (1 = ajustar à largura). */
  pdfZoom: number;
  iconStyle: IconStyle;
  /** Fontes do Google adicionadas pelo usuário (as padrão não ficam aqui). */
  extraFonts: FontFamily[];
  /** Ícones Material Symbols adicionados pelo usuário à coleção. */
  extraIcons: string[];
  /** Marca-textos criados pelo usuário. */
  customHighlighters: Highlighter[];
  /** Marca-textos padrão ocultados pelo usuário. */
  hiddenHighlighterIds: string[];
  activeHighlighterId: string;
  recentStickers: string[];
}

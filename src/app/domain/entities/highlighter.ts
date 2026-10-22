export type HighlighterStyle = 'highlight' | 'underline' | 'wavy' | 'strike' | 'box' | 'gradient';

export interface Highlighter {
  readonly id: string;
  name: string;
  color: string;
  style: HighlighterStyle;
  /** 0..1, usado pelos estilos de preenchimento. */
  opacity: number;
  readonly builtIn: boolean;
}

export const HIGHLIGHTER_STYLE_LABELS: Record<HighlighterStyle, string> = {
  highlight: 'Marca-texto',
  gradient: 'Marca-texto (meia altura)',
  underline: 'Sublinhado',
  wavy: 'Ondulado',
  strike: 'Riscado',
  box: 'Caixa',
};

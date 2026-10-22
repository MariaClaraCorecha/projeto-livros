export interface Paper {
  readonly id: string;
  readonly name: string;
  /** Valor CSS de `background`. */
  readonly background: string;
  readonly textColor: string;
  readonly dark: boolean;
  /** Filtro CSS aplicado às páginas renderizadas como imagem (PDF). */
  readonly pdfFilter: string;
}

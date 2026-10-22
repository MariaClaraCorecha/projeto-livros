export type FontCategory = 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
export type FontSource = 'system' | 'google';

export interface FontFamily {
  readonly family: string;
  readonly category: FontCategory;
  readonly source: FontSource;
  readonly builtIn: boolean;
}

export function fontStack(font: Pick<FontFamily, 'family' | 'category'>): string {
  const fallback = font.category === 'monospace' ? 'monospace' : font.category === 'serif' ? 'serif' : 'sans-serif';
  return `"${font.family}", ${fallback}`;
}

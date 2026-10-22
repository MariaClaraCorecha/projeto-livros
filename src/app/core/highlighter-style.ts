import { Highlighter } from '../domain/entities';


export function highlighterCss(h: Highlighter | null): Partial<CSSStyleDeclaration> {
  if (!h) {
    return { textDecoration: 'underline dotted', textDecorationColor: '#868e96', textUnderlineOffset: '3px' };
  }
  const fill = withAlpha(h.color, h.opacity);
  switch (h.style) {
    case 'highlight':
      return { backgroundColor: fill };
    case 'gradient':
      return { backgroundImage: `linear-gradient(transparent 55%, ${fill} 55%)` };
    case 'underline':
      return { textDecoration: 'underline solid', textDecorationColor: h.color, textDecorationThickness: '2px', textUnderlineOffset: '3px' };
    case 'wavy':
      return { textDecoration: 'underline wavy', textDecorationColor: h.color, textDecorationThickness: '1.5px', textUnderlineOffset: '3px' };
    case 'strike':
      return { textDecoration: 'line-through solid', textDecorationColor: h.color, textDecorationThickness: '2px' };
    case 'box':
      return { boxShadow: `inset 0 0 0 1.5px ${h.color}`, borderRadius: '3px' };
  }
}

export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Mesmo estilo de `highlighterCss`, como texto para bindings `[style]`. */
export function highlighterStyle(h: Highlighter | null): string {
  return Object.entries(highlighterCss(h) as Record<string, string>)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v}`)
    .join('; ');
}

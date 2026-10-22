import { Highlighter } from '../entities';

/** Paleta única de cores: usada pelos marca-textos padrão e pelo editor de marca-textos. */
export const HIGHLIGHTER_COLORS = {
  yellow: { name: 'Amarelo', hex: '#ffd43b' },
  lime: { name: 'Limão', hex: '#c0eb75' },
  green: { name: 'Verde', hex: '#69db7c' },
  mint: { name: 'Menta', hex: '#63e6be' },
  teal: { name: 'Turquesa', hex: '#3bc9db' },
  sky: { name: 'Azul-claro', hex: '#74c0fc' },
  blue: { name: 'Azul', hex: '#4dabf7' },
  royal: { name: 'Azul forte', hex: '#1c7ed6' },
  indigo: { name: 'Índigo', hex: '#748ffc' },
  purple: { name: 'Roxo', hex: '#9775fa' },
  lilac: { name: 'Lilás', hex: '#da77f2' },
  pink: { name: 'Rosa', hex: '#f783ac' },
  red: { name: 'Vermelho', hex: '#fa5252' },
  coral: { name: 'Coral', hex: '#ff8787' },
  orange: { name: 'Laranja', hex: '#ffa94d' },
  peach: { name: 'Pêssego', hex: '#ffc078' },
  brown: { name: 'Marrom', hex: '#a9744f' },
  gray: { name: 'Cinza', hex: '#868e96' },
  black: { name: 'Preto', hex: '#212529' },
} as const;

export type HighlighterColorKey = keyof typeof HIGHLIGHTER_COLORS;

export const HIGHLIGHTER_PALETTE: readonly { readonly name: string; readonly hex: string }[] = Object.values(HIGHLIGHTER_COLORS);

const c = (key: HighlighterColorKey) => HIGHLIGHTER_COLORS[key].hex;

/* Os ids são permanentes: anotações já salvas apontam para eles. */
export const DEFAULT_HIGHLIGHTERS: readonly Highlighter[] = [
  { id: 'hl-yellow', name: 'Amarelo', color: c('yellow'), style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-green', name: 'Verde', color: c('green'), style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-mint', name: 'Menta', color: c('mint'), style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-blue', name: 'Azul', color: c('blue'), style: 'highlight', opacity: 0.4, builtIn: true },
  { id: 'hl-lilac', name: 'Lilás', color: c('lilac'), style: 'highlight', opacity: 0.4, builtIn: true },
  { id: 'hl-pink', name: 'Rosa', color: c('pink'), style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-coral', name: 'Coral', color: c('coral'), style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-peach', name: 'Pêssego', color: c('peach'), style: 'highlight', opacity: 0.5, builtIn: true },
  { id: 'hl-gray', name: 'Cinza', color: c('gray'), style: 'highlight', opacity: 0.35, builtIn: true },
  { id: 'hl-orange', name: 'Laranja', color: c('orange'), style: 'gradient', opacity: 0.6, builtIn: true },
  { id: 'hl-teal-gradient', name: 'Turquesa', color: c('teal'), style: 'gradient', opacity: 0.55, builtIn: true },
  { id: 'hl-purple', name: 'Roxo sublinhado', color: c('purple'), style: 'underline', opacity: 1, builtIn: true },
  { id: 'hl-red-wavy', name: 'Vermelho ondulado', color: c('red'), style: 'wavy', opacity: 1, builtIn: true },
  { id: 'hl-strike', name: 'Riscado', color: c('gray'), style: 'strike', opacity: 1, builtIn: true },
  { id: 'hl-box', name: 'Caixa azul', color: c('royal'), style: 'box', opacity: 1, builtIn: true },
];

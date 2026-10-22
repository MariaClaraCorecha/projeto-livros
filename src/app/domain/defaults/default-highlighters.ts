import { Highlighter } from '../entities';

export const DEFAULT_HIGHLIGHTERS: readonly Highlighter[] = [
  { id: 'hl-yellow', name: 'Amarelo', color: '#ffd43b', style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-green', name: 'Verde', color: '#69db7c', style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-blue', name: 'Azul', color: '#4dabf7', style: 'highlight', opacity: 0.4, builtIn: true },
  { id: 'hl-pink', name: 'Rosa', color: '#f783ac', style: 'highlight', opacity: 0.45, builtIn: true },
  { id: 'hl-orange', name: 'Laranja', color: '#ffa94d', style: 'gradient', opacity: 0.6, builtIn: true },
  { id: 'hl-purple', name: 'Roxo sublinhado', color: '#9775fa', style: 'underline', opacity: 1, builtIn: true },
  { id: 'hl-red-wavy', name: 'Vermelho ondulado', color: '#fa5252', style: 'wavy', opacity: 1, builtIn: true },
  { id: 'hl-strike', name: 'Riscado', color: '#868e96', style: 'strike', opacity: 1, builtIn: true },
  { id: 'hl-box', name: 'Caixa azul', color: '#1c7ed6', style: 'box', opacity: 1, builtIn: true },
];

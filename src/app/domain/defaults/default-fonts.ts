import { FontFamily } from '../entities';

/** Fontes que já vêm no sistema. As do Google são carregadas sob demanda. */
export const DEFAULT_FONTS: readonly FontFamily[] = [
  { family: 'Literata', category: 'serif', source: 'google', builtIn: true },
  { family: 'Merriweather', category: 'serif', source: 'google', builtIn: true },
  { family: 'Lora', category: 'serif', source: 'google', builtIn: true },
  { family: 'EB Garamond', category: 'serif', source: 'google', builtIn: true },
  { family: 'Roboto', category: 'sans-serif', source: 'google', builtIn: true },
  { family: 'Open Sans', category: 'sans-serif', source: 'google', builtIn: true },
  { family: 'Atkinson Hyperlegible', category: 'sans-serif', source: 'google', builtIn: true },
  { family: 'Georgia', category: 'serif', source: 'system', builtIn: true },
  { family: 'Arial', category: 'sans-serif', source: 'system', builtIn: true },
];

export const ORIGINAL_FONT = '__original__';

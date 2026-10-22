import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';
import { FontCategory, FontFamily } from '../../domain/entities';
import { FontCatalog, FontLoader } from '../../application/ports';

const CSS_API = 'https://fonts.googleapis.com/css2';

function familyParam(family: string): string {
  return encodeURIComponent(family.trim()).replace(/%20/g, '+');
}

/** Injeta folhas de estilo do Google Fonts no documento sob demanda. */
@Injectable()
export class GoogleFontLoader extends FontLoader {
  private readonly document = inject(DOCUMENT);
  private readonly loaded = new Map<string, Promise<string | null>>();

  stylesheetUrl(font: Pick<FontFamily, 'family' | 'source'>): string | null {
    if (font.source === 'system') return null;
    return `${CSS_API}?family=${familyParam(font.family)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  }

  async load(font: Pick<FontFamily, 'family' | 'source'>): Promise<boolean> {
    if (font.source === 'system') return true;
    const key = font.family.toLowerCase();
    if (!this.loaded.has(key)) this.loaded.set(key, this.inject(font.family));
    const url = await this.loaded.get(key)!;
    if (!url) this.loaded.delete(key);
    return url !== null;
  }

  loadIconFont(style: 'outlined' | 'rounded' | 'sharp'): { family: string; url: string } {
    const family = `Material Symbols ${style[0].toUpperCase()}${style.slice(1)}`;
    const url = `${CSS_API}?family=${familyParam(family)}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block`;
    if (!this.document.head.querySelector(`link[data-icon-font="${style}"]`)) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.dataset['iconFont'] = style;
      this.document.head.appendChild(link);
    }
    return { family, url };
  }

  /**
   * Nem toda família tem itálico/negrito: se a URL completa falhar (HTTP 400),
   * tenta só o peso regular. Resolve a URL usada ou `null` se a família não existe.
   */
  private async inject(family: string): Promise<string | null> {
    const full = this.stylesheetUrl({ family, source: 'google' })!;
    const regular = `${CSS_API}?family=${familyParam(family)}&display=swap`;
    for (const url of [full, regular]) {
      if (await this.appendLink(url)) return url;
    }
    return null;
  }

  private appendLink(href: string): Promise<boolean> {
    return new Promise((resolve) => {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve(true);
      link.onerror = () => {
        link.remove();
        resolve(false);
      };
      this.document.head.appendChild(link);
    });
  }
}

/**
 * Catálogo de fontes do Google. Com `googleFontsApiKey` lista o catálogo completo;
 * sem ela usa uma seleção curada (o usuário ainda pode adicionar qualquer família pelo nome).
 */
@Injectable()
export class GoogleFontCatalog extends FontCatalog {
  readonly complete = !!environment.googleFontsApiKey;
  private cache?: Promise<FontFamily[]>;

  list(): Promise<FontFamily[]> {
    this.cache ??= this.complete ? this.fetchAll().catch(() => CURATED) : Promise.resolve(CURATED);
    return this.cache;
  }

  private async fetchAll(): Promise<FontFamily[]> {
    const res = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${environment.googleFontsApiKey}`,
    );
    if (!res.ok) throw new Error(`Google Fonts API: ${res.status}`);
    const json = (await res.json()) as { items: { family: string; category: string }[] };
    return json.items.map((i) => google(i.family, i.category as FontCategory));
  }
}

const google = (family: string, category: FontCategory): FontFamily => ({
  family,
  category,
  source: 'google',
  builtIn: false,
});

const CURATED: FontFamily[] = [
  ...['Crimson Pro', 'Crimson Text', 'Libre Baskerville', 'Playfair Display', 'PT Serif', 'Noto Serif', 'Source Serif 4',
    'Cormorant Garamond', 'Spectral', 'Vollkorn', 'Alegreya', 'Bitter', 'Cardo', 'Domine', 'Gelasio', 'Newsreader',
    'Old Standard TT', 'Zilla Slab', 'Roboto Serif', 'Fraunces', 'Libre Caslon Text', 'Sorts Mill Goudy', 'Gentium Book Plus',
  ].map((f) => google(f, 'serif')),
  ...['Inter', 'Lato', 'Montserrat', 'Nunito', 'Poppins', 'Raleway', 'Source Sans 3', 'Noto Sans', 'Work Sans', 'Karla',
    'Mulish', 'Rubik', 'Fira Sans', 'IBM Plex Sans', 'Lexend', 'Figtree', 'DM Sans', 'Manrope', 'Outfit', 'Quicksand',
    'Ubuntu', 'Cabin', 'Hind', 'Josefin Sans', 'Barlow', 'Andika',
  ].map((f) => google(f, 'sans-serif')),
  ...['Abril Fatface', 'Bebas Neue', 'Lobster', 'Righteous', 'Cinzel', 'Uncial Antiqua', 'Pirata One', 'Special Elite',
    'MedievalSharp', 'IM Fell English',
  ].map((f) => google(f, 'display')),
  ...['Caveat', 'Dancing Script', 'Pacifico', 'Indie Flower', 'Shadows Into Light', 'Patrick Hand', 'Kalam',
    'Architects Daughter', 'Gloria Hallelujah', 'Satisfy', 'Great Vibes', 'Homemade Apple',
  ].map((f) => google(f, 'handwriting')),
  ...['JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Source Code Pro', 'Courier Prime', 'Space Mono', 'Roboto Mono',
  ].map((f) => google(f, 'monospace')),
];

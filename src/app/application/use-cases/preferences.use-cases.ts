import { inject, Injectable } from '@angular/core';
import { createDefaultPreferences, DEFAULT_FONTS, DEFAULT_HIGHLIGHTERS, DEFAULT_ICONS } from '../../domain/defaults';
import { FontFamily, Highlighter, ReaderPreferences } from '../../domain/entities';
import { PreferencesRepository } from '../../domain/repositories';
import { FontLoader } from '../ports';
import { CurrentUser, newId } from './current-user';

@Injectable({ providedIn: 'root' })
export class LoadPreferencesUseCase {
  private readonly repo = inject(PreferencesRepository);
  private readonly user = inject(CurrentUser);

  async execute(): Promise<ReaderPreferences> {
    const ownerId = this.user.id();
    const stored = await this.repo.get(ownerId);
    // Mescla com o padrão para tolerar preferências salvas por versões antigas.
    return { ...createDefaultPreferences(ownerId), ...stored };
  }
}

@Injectable({ providedIn: 'root' })
export class SavePreferencesUseCase {
  private readonly repo = inject(PreferencesRepository);

  async execute(prefs: ReaderPreferences, changes: Partial<ReaderPreferences>): Promise<ReaderPreferences> {
    const updated = { ...prefs, ...changes };
    await this.repo.save(updated);
    return updated;
  }
}

export class FontNotFoundError extends Error {
  constructor(family: string) {
    super(`A fonte "${family}" não foi encontrada no Google Fonts.`);
  }
}

/** Fontes: as padrão do sistema + as que o usuário adicionou do Google Fonts. */
@Injectable({ providedIn: 'root' })
export class ManageFontsUseCase {
  private readonly loader = inject(FontLoader);
  private readonly save = inject(SavePreferencesUseCase);

  available(prefs: ReaderPreferences): FontFamily[] {
    return [...DEFAULT_FONTS, ...prefs.extraFonts];
  }

  async add(prefs: ReaderPreferences, font: Omit<FontFamily, 'builtIn' | 'source'>): Promise<ReaderPreferences> {
    const family = font.family.trim();
    if (this.available(prefs).some((f) => f.family.toLowerCase() === family.toLowerCase())) return prefs;
    const candidate: FontFamily = { family, category: font.category, source: 'google', builtIn: false };
    if (!(await this.loader.load(candidate))) throw new FontNotFoundError(family);
    return this.save.execute(prefs, { extraFonts: [...prefs.extraFonts, candidate] });
  }

  remove(prefs: ReaderPreferences, family: string): Promise<ReaderPreferences> {
    const extraFonts = prefs.extraFonts.filter((f) => f.family !== family);
    const fontFamily = prefs.fontFamily === family ? createDefaultPreferences(prefs.ownerId).fontFamily : prefs.fontFamily;
    return this.save.execute(prefs, { extraFonts, fontFamily });
  }
}

@Injectable({ providedIn: 'root' })
export class ManageHighlightersUseCase {
  private readonly save = inject(SavePreferencesUseCase);

  /** Todos os marca-textos (inclui ocultos). */
  all(prefs: ReaderPreferences): Highlighter[] {
    return [...DEFAULT_HIGHLIGHTERS, ...prefs.customHighlighters];
  }

  visible(prefs: ReaderPreferences): Highlighter[] {
    return this.all(prefs).filter((h) => !prefs.hiddenHighlighterIds.includes(h.id));
  }

  create(prefs: ReaderPreferences, data: Omit<Highlighter, 'id' | 'builtIn'>): Promise<ReaderPreferences> {
    const highlighter: Highlighter = { ...data, id: newId(), builtIn: false };
    return this.save.execute(prefs, {
      customHighlighters: [...prefs.customHighlighters, highlighter],
      activeHighlighterId: highlighter.id,
    });
  }

  update(prefs: ReaderPreferences, highlighter: Highlighter): Promise<ReaderPreferences> {
    return this.save.execute(prefs, {
      customHighlighters: prefs.customHighlighters.map((h) => (h.id === highlighter.id ? highlighter : h)),
    });
  }

  /** Personalizados são excluídos; os padrão apenas ficam ocultos (anotações antigas continuam com a cor). */
  remove(prefs: ReaderPreferences, highlighter: Highlighter): Promise<ReaderPreferences> {
    const changes: Partial<ReaderPreferences> = highlighter.builtIn
      ? { hiddenHighlighterIds: [...prefs.hiddenHighlighterIds, highlighter.id] }
      : { customHighlighters: prefs.customHighlighters.filter((h) => h.id !== highlighter.id) };
    if (prefs.activeHighlighterId === highlighter.id) changes.activeHighlighterId = DEFAULT_HIGHLIGHTERS[0].id;
    return this.save.execute(prefs, changes);
  }

  restoreDefaults(prefs: ReaderPreferences): Promise<ReaderPreferences> {
    return this.save.execute(prefs, { hiddenHighlighterIds: [] });
  }
}

@Injectable({ providedIn: 'root' })
export class ManageIconsUseCase {
  private readonly save = inject(SavePreferencesUseCase);

  collection(prefs: ReaderPreferences): string[] {
    return [...DEFAULT_ICONS, ...prefs.extraIcons];
  }

  add(prefs: ReaderPreferences, name: string): Promise<ReaderPreferences> {
    const icon = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!icon || this.collection(prefs).includes(icon)) return Promise.resolve(prefs);
    return this.save.execute(prefs, { extraIcons: [...prefs.extraIcons, icon] });
  }

  remove(prefs: ReaderPreferences, name: string): Promise<ReaderPreferences> {
    return this.save.execute(prefs, { extraIcons: prefs.extraIcons.filter((i) => i !== name) });
  }
}

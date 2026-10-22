import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DEFAULT_FONTS, DEFAULT_PAPERS, ORIGINAL_FONT } from '../../domain/defaults';
import { CustomSticker, FontFamily, fontStack, Highlighter, IconStyle, ReaderPreferences, StickerRef } from '../../domain/entities';
import { FontLoader, ReaderAppearance, ResolvedSticker } from '../../application/ports';
import {
  LoadPreferencesUseCase,
  ManageFontsUseCase,
  ManageHighlightersUseCase,
  ManageIconsUseCase,
  ManageStickersUseCase,
  SavePreferencesUseCase,
  StickerData,
  StickerPackFile,
} from '../../application/use-cases';
import { SessionStore } from './session.store';

/** Preferências de leitura e personalização (fontes, ícones, marca-textos, figurinhas, tema). */
@Injectable({ providedIn: 'root' })
export class PreferencesStore {
  private readonly document = inject(DOCUMENT);
  private readonly session = inject(SessionStore);
  private readonly loadUseCase = inject(LoadPreferencesUseCase);
  private readonly saveUseCase = inject(SavePreferencesUseCase);
  private readonly fontsUseCase = inject(ManageFontsUseCase);
  private readonly highlightersUseCase = inject(ManageHighlightersUseCase);
  private readonly iconsUseCase = inject(ManageIconsUseCase);
  private readonly stickersUseCase = inject(ManageStickersUseCase);
  private readonly fontLoader = inject(FontLoader);

  private readonly state = signal<ReaderPreferences | null>(null);
  readonly prefs = this.state.asReadonly();
  readonly customStickers = signal<CustomSticker[]>([]);

  readonly fonts = computed<FontFamily[]>(() => {
    const p = this.state();
    return p ? this.fontsUseCase.available(p) : [...DEFAULT_FONTS];
  });
  readonly allHighlighters = computed<Highlighter[]>(() => (this.state() ? this.highlightersUseCase.all(this.state()!) : []));
  readonly highlighters = computed<Highlighter[]>(() => (this.state() ? this.highlightersUseCase.visible(this.state()!) : []));
  readonly activeHighlighter = computed(
    () => this.highlighters().find((h) => h.id === this.state()?.activeHighlighterId) ?? this.highlighters()[0] ?? null,
  );
  readonly icons = computed<string[]>(() => (this.state() ? this.iconsUseCase.collection(this.state()!) : []));
  readonly papers = DEFAULT_PAPERS;
  readonly paper = computed(() => DEFAULT_PAPERS.find((p) => p.id === this.state()?.paperId) ?? DEFAULT_PAPERS[0]);
  readonly iconFont = computed(() => this.fontLoader.loadIconFont(this.state()?.iconStyle ?? 'outlined'));

  private readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => {
    const mode = this.state()?.themeMode ?? 'system';
    return mode === 'dark' || (mode === 'system' && this.systemDark());
  });

  readonly appearance = computed<ReaderAppearance | null>(() => {
    const p = this.state();
    if (!p) return null;
    const font = p.fontFamily === ORIGINAL_FONT ? null : this.fonts().find((f) => f.family === p.fontFamily);
    return {
      font: font ? { stack: fontStack(font), stylesheetUrl: this.fontLoader.stylesheetUrl(font) } : null,
      fontSize: p.fontSize,
      lineHeight: p.lineHeight,
      margin: p.margin,
      textAlign: p.textAlign,
      paper: this.paper(),
      flow: p.flow,
      pdfZoom: p.pdfZoom,
      iconFont: this.iconFont(),
    };
  });

  constructor() {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => this.systemDark.set(e.matches));

    // Carrega as preferências do usuário que entrou.
    effect(() => {
      const user = this.session.user();
      untracked(() => {
        this.state.set(null);
        this.customStickers.set([]);
        if (user) void this.load();
      });
    });

    // Tema claro/escuro do app.
    effect(() => {
      const html = this.document.documentElement;
      html.classList.toggle('theme-dark', this.dark());
      html.classList.toggle('theme-light', !this.dark());
    });

    // Mantém a fonte de leitura carregada.
    effect(() => {
      const family = this.state()?.fontFamily;
      const font = this.fonts().find((f) => f.family === family);
      if (font) void this.fontLoader.load(font);
    });
  }

  private async load(): Promise<void> {
    const [prefs, stickers] = await Promise.all([this.loadUseCase.execute(), this.stickersUseCase.list()]);
    this.state.set(prefs);
    this.customStickers.set(stickers);
  }

  async update(changes: Partial<ReaderPreferences>): Promise<void> {
    const current = this.state();
    if (!current) return;
    this.state.set({ ...current, ...changes });
    await this.saveUseCase.execute(current, changes);
  }

  /* Fontes ------------------------------------------------------------ */

  loadFont(font: FontFamily): Promise<boolean> {
    return this.fontLoader.load(font);
  }

  async addFont(font: Pick<FontFamily, 'family' | 'category'>): Promise<void> {
    this.state.set(await this.fontsUseCase.add(this.require(), font));
  }

  async removeFont(family: string): Promise<void> {
    this.state.set(await this.fontsUseCase.remove(this.require(), family));
  }

  /* Marca-textos --------------------------------------------------------- */

  async createHighlighter(data: Omit<Highlighter, 'id' | 'builtIn'>): Promise<void> {
    this.state.set(await this.highlightersUseCase.create(this.require(), data));
  }

  async updateHighlighter(h: Highlighter): Promise<void> {
    this.state.set(await this.highlightersUseCase.update(this.require(), h));
  }

  async removeHighlighter(h: Highlighter): Promise<void> {
    this.state.set(await this.highlightersUseCase.remove(this.require(), h));
  }

  async restoreHighlighters(): Promise<void> {
    this.state.set(await this.highlightersUseCase.restoreDefaults(this.require()));
  }

  /* Ícones -------------------------------------------------------------- */

  loadIconStyle(style: IconStyle): void {
    this.fontLoader.loadIconFont(style);
  }

  async addIcon(name: string): Promise<void> {
    this.state.set(await this.iconsUseCase.add(this.require(), name));
  }

  async removeIcon(name: string): Promise<void> {
    this.state.set(await this.iconsUseCase.remove(this.require(), name));
  }

  /* Figurinhas ---------------------------------------------------------- */

  async addSticker(name: string, dataUrl: string): Promise<void> {
    const sticker = await this.stickersUseCase.create(name, dataUrl);
    this.customStickers.update((list) => [...list, sticker]);
  }

  /** Adiciona várias figurinhas (importação) e retorna quantas eram novas. */
  async addStickers(items: readonly StickerData[]): Promise<number> {
    const created = await this.stickersUseCase.createMany(items);
    if (created.length) this.customStickers.update((list) => [...list, ...created]);
    return created.length;
  }

  exportStickers(): Promise<StickerPackFile> {
    return this.stickersUseCase.exportPack();
  }

  async removeSticker(id: string): Promise<void> {
    await this.stickersUseCase.delete(id);
    this.customStickers.update((list) => list.filter((s) => s.id !== id));
  }

  /** Guarda as figurinhas usadas recentemente (chave `tipo:valor`). */
  async rememberSticker(ref: StickerRef): Promise<void> {
    const key = `${ref.kind}:${ref.value}`;
    const recent = [key, ...(this.state()?.recentStickers ?? []).filter((k) => k !== key)].slice(0, 16);
    await this.update({ recentStickers: recent });
  }

  resolveSticker(ref: StickerRef | null): ResolvedSticker | null {
    if (!ref) return null;
    if (ref.kind === 'emoji') return ref;
    if (ref.kind === 'icon') return { kind: 'icon', value: ref.value, fontFamily: this.iconFont().family };
    const custom = this.customStickers().find((s) => s.id === ref.value);
    return custom ? { kind: 'image', url: custom.dataUrl } : null;
  }

  private require(): ReaderPreferences {
    const p = this.state();
    if (!p) throw new Error('Preferências ainda não carregadas.');
    return p;
  }
}

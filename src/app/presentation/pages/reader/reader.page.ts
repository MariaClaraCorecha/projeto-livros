import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Annotation, Book, Highlighter } from '../../../domain/entities';
import {
  AnnotationDecoration,
  ReaderAppearance,
  ReaderEngine,
  ReaderEngineFactory,
  ReaderLocation,
  ReaderSelection,
  TocItem,
} from '../../../application/ports';
import {
  AnnotationDraft,
  CreateAnnotationUseCase,
  DeleteAnnotationUseCase,
  ListAnnotationsUseCase,
  OpenBookUseCase,
  SaveReadingProgressUseCase,
  UpdateAnnotationUseCase,
} from '../../../application/use-cases';
import { AnnotationDialog, AnnotationDialogData, AnnotationDialogResult } from '../../dialogs/annotation.dialog';
import { confirmDialog } from '../../dialogs/confirm.dialog';
import { StickerPickerDialog, StickerPickerResult } from '../../dialogs/sticker-picker.dialog';
import { LibraryStore } from '../../state/library.store';
import { PreferencesStore } from '../../state/preferences.store';
import { AnnotationsPanelComponent } from './annotations-panel.component';
import { AppearancePanelComponent } from './appearance-panel.component';
import { SelectionToolbarComponent } from './selection-toolbar.component';
import { TocPanelComponent } from './toc-panel.component';

type Panel = 'toc' | 'notes' | 'appearance';

@Component({
  selector: 'app-reader-page',
  imports: [
    RouterLink, DecimalPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSidenavModule, MatSliderModule,
    MatTooltipModule, MatBadgeModule, AnnotationsPanelComponent, AppearancePanelComponent, SelectionToolbarComponent, TocPanelComponent,
  ],
  templateUrl: './reader.page.html',
  styleUrl: './reader.page.scss',
  host: { '(window:keydown)': 'onKey($event)' },
})
export class ReaderPage {
  /** Parâmetro de rota `:id`. */
  readonly id = input.required<string>();

  protected readonly prefs = inject(PreferencesStore);
  private readonly library = inject(LibraryStore);
  private readonly engines = inject(ReaderEngineFactory);
  private readonly openBook = inject(OpenBookUseCase);
  private readonly saveProgress = inject(SaveReadingProgressUseCase);
  private readonly listAnnotations = inject(ListAnnotationsUseCase);
  private readonly createAnnotation = inject(CreateAnnotationUseCase);
  private readonly updateAnnotation = inject(UpdateAnnotationUseCase);
  private readonly deleteAnnotation = inject(DeleteAnnotationUseCase);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly title = inject(Title);
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');

  protected readonly book = signal<Book | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly location = signal<ReaderLocation | null>(null);
  protected readonly selection = signal<ReaderSelection | null>(null);
  protected readonly annotations = signal<Annotation[]>([]);
  protected readonly toc = signal<TocItem[]>([]);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly reflowable = signal(true);

  private engine: ReaderEngine | null = null;
  private engineReady = false;
  private pendingSave: { location?: string; progress?: number; cache?: string } = {};
  private saveTimer?: ReturnType<typeof setTimeout>;
  private appearanceTimer?: ReturnType<typeof setTimeout>;

  protected readonly paper = this.prefs.paper;

  protected readonly decorations = computed<AnnotationDecoration[]>(() => {
    const highlighters = this.prefs.allHighlighters();
    return this.annotations().map((annotation) => ({
      annotation,
      highlighter: highlighters.find((h) => h.id === annotation.highlighterId) ?? null,
      sticker: this.prefs.resolveSticker(annotation.sticker),
    }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => void this.start());

    // Preferências mudaram → reaplica no livro (com pequeno atraso para não travar ao arrastar sliders).
    effect(() => {
      const appearance = this.prefs.appearance();
      if (!appearance) return;
      untracked(() => {
        clearTimeout(this.appearanceTimer);
        this.appearanceTimer = setTimeout(() => this.engineReady && this.engine?.setAppearance(appearance), 220);
      });
    });

    // Anotações mudaram → redesenha marcas e figurinhas.
    effect(() => {
      const decorations = this.decorations();
      untracked(() => this.engineReady && this.engine?.setDecorations(decorations));
    });

    destroyRef.onDestroy(() => {
      clearTimeout(this.appearanceTimer);
      this.flushSave();
      this.engine?.destroy();
    });
  }

  private async start(): Promise<void> {
    try {
      const appearance = await this.waitForAppearance();
      const { book, file } = await this.openBook.execute(this.id());
      this.book.set(book);
      this.title.setTitle(`${book.title} · Estante`);
      this.library.patchLocal(book.id, { lastOpenedAt: book.lastOpenedAt });
      this.annotations.set(await this.listAnnotations.execute(book.id));

      const engine = await this.engines.create(book.format);
      this.engine = engine;
      this.reflowable.set(engine.reflowable);
      await engine.open(this.viewport().nativeElement, {
        file,
        location: book.lastLocation,
        cache: book.engineCache,
        appearance,
        decorations: this.decorations(),
        events: {
          relocated: (loc) => this.onRelocated(loc),
          selected: (sel) => this.selection.set(sel),
          annotationClicked: (id) => this.onAnnotationClicked(id),
          cacheUpdated: (cache) => this.queueSave({ cache }),
        },
      });
      this.engineReady = true;
      this.toc.set(await engine.toc().catch(() => []));
    } catch (e) {
      console.error(e);
      this.error.set(e instanceof Error ? e.message : 'Não foi possível abrir o livro.');
    } finally {
      this.loading.set(false);
    }
  }

  private waitForAppearance(): Promise<ReaderAppearance> {
    return new Promise((resolve) => {
      const check = () => {
        const a = this.prefs.appearance();
        if (a) resolve(a);
        else setTimeout(check, 30);
      };
      check();
    });
  }

  /* Navegação ------------------------------------------------------------ */

  protected next(): void {
    this.engine?.next();
  }

  protected prev(): void {
    this.engine?.prev();
  }

  protected goTo(target: string): void {
    void this.engine?.goTo(target);
    this.panel.set(null);
  }

  protected seek(percent: number): void {
    void this.engine?.goToProgress(percent / 100);
  }

  protected togglePanel(panel: Panel): void {
    this.panel.update((p) => (p === panel ? null : panel));
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.dialog.openDialogs.length || target?.closest('input, textarea, [contenteditable]')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') this.next();
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') this.prev();
    else if (event.key === 'Escape') this.dismissSelection();
  }

  private onRelocated(location: ReaderLocation): void {
    this.location.set(location);
    this.queueSave({ location: location.location, progress: location.progress });
  }

  private queueSave(changes: { location?: string; progress?: number; cache?: string }): void {
    this.pendingSave = { ...this.pendingSave, ...changes };
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 800);
  }

  private flushSave(): void {
    clearTimeout(this.saveTimer);
    const book = this.book();
    if (!book || !Object.keys(this.pendingSave).length) return;
    const changes = this.pendingSave;
    this.pendingSave = {};
    void this.saveProgress.execute(book.id, changes);
    this.library.patchLocal(book.id, {
      ...(changes.progress !== undefined && { progress: changes.progress }),
      ...(changes.location !== undefined && { lastLocation: changes.location }),
    });
  }

  /* Seleção → anotações ------------------------------------------------- */

  protected async highlight(h: Highlighter): Promise<void> {
    void this.prefs.update({ activeHighlighterId: h.id });
    await this.createFromSelection({ highlighterId: h.id });
  }

  protected async commentSelection(): Promise<void> {
    const sel = this.selection();
    if (!sel) return;
    const result = await this.openAnnotationDialog({ quote: sel.quote, focusComment: true });
    if (result?.action === 'save') await this.createFromSelection(result.draft, sel);
  }

  protected async stickerSelection(): Promise<void> {
    const sel = this.selection();
    if (!sel) return;
    const sticker = await firstValueFrom(
      this.dialog
        .open<StickerPickerDialog, unknown, StickerPickerResult>(StickerPickerDialog, { data: { allowRemove: false }, width: '520px' })
        .afterClosed(),
    );
    if (sticker && sticker !== 'remove') await this.createFromSelection({ highlighterId: null, sticker }, sel);
  }

  protected async copySelection(): Promise<void> {
    const sel = this.selection();
    if (!sel) return;
    await navigator.clipboard.writeText(sel.quote);
    this.snack.open('Trecho copiado.');
    this.dismissSelection();
  }

  protected dismissSelection(): void {
    this.engine?.clearSelection();
    this.selection.set(null);
  }

  private async createFromSelection(draft: AnnotationDraft, sel = this.selection()): Promise<void> {
    const book = this.book();
    if (!book || !sel) return;
    const annotation = await this.createAnnotation.execute(book.id, sel, draft);
    this.annotations.update((list) => [...list, annotation].sort((a, b) => a.sortKey - b.sortKey));
    this.dismissSelection();
  }

  /* Edição de anotações ---------------------------------------------- */

  private onAnnotationClicked(id: string): void {
    const annotation = this.annotations().find((a) => a.id === id);
    if (annotation) void this.editAnnotation(annotation);
  }

  protected async editAnnotation(annotation: Annotation): Promise<void> {
    const result = await this.openAnnotationDialog({ quote: annotation.quote, annotation });
    if (!result) return;
    if (result.action === 'delete') {
      await this.removeAnnotation(annotation, false);
      return;
    }
    const updated = await this.updateAnnotation.execute(annotation, result.draft);
    this.annotations.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
  }

  protected async removeAnnotation(annotation: Annotation, ask = true): Promise<void> {
    if (ask && !(await confirmDialog(this.dialog, { title: 'Excluir anotação?', message: annotation.quote.slice(0, 160), confirm: 'Excluir', danger: true }))) {
      return;
    }
    await this.deleteAnnotation.execute(annotation.id);
    this.annotations.update((list) => list.filter((a) => a.id !== annotation.id));
    this.snack
      .open('Anotação excluída.', 'Desfazer')
      .onAction()
      .subscribe(async () => {
        const book = this.book();
        if (!book) return;
        const restored = await this.createAnnotation.execute(
          book.id,
          { anchor: annotation.anchor, quote: annotation.quote, locationLabel: annotation.locationLabel, sortKey: annotation.sortKey },
          { highlighterId: annotation.highlighterId, comment: annotation.comment, sticker: annotation.sticker },
        );
        this.annotations.update((list) => [...list, restored].sort((a, b) => a.sortKey - b.sortKey));
      });
  }

  protected goToAnnotation(annotation: Annotation): void {
    void this.engine?.goToAnchor(annotation.anchor);
    if (matchMedia('(max-width: 900px)').matches) this.panel.set(null);
  }

  private openAnnotationDialog(data: AnnotationDialogData): Promise<AnnotationDialogResult | undefined> {
    return firstValueFrom(
      this.dialog
        .open<AnnotationDialog, AnnotationDialogData, AnnotationDialogResult>(AnnotationDialog, { data, width: '520px', autoFocus: data.focusComment ? 'first-tabbable' : 'dialog' })
        .afterClosed(),
    );
  }
}

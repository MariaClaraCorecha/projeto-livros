import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { Annotation, StickerRef } from '../../domain/entities';
import { AnnotationDraft } from '../../application/use-cases';
import { PreferencesStore } from '../state/preferences.store';
import { HighlighterSwatchComponent } from '../shared/highlighter-swatch.component';
import { StickerViewComponent } from '../shared/sticker-view.component';
import { StickerPickerDialog, StickerPickerResult } from './sticker-picker.dialog';

export interface AnnotationDialogData {
  quote: string;
  annotation?: Annotation;
  /** Abre com o campo de comentário focado. */
  focusComment?: boolean;
  draft?: Partial<AnnotationDraft>;
}

export type AnnotationDialogResult = { action: 'save'; draft: AnnotationDraft } | { action: 'delete' };

@Component({
  selector: 'app-annotation-dialog',
  imports: [
    FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTooltipModule,
    HighlighterSwatchComponent, StickerViewComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.annotation ? 'Anotação' : 'Nova anotação' }}</h2>
    <mat-dialog-content class="dialog-body">
      <blockquote>{{ data.quote }}</blockquote>

      <!-- Novas anotações usam o marca-texto escolhido na barra de seleção; aqui só se troca o de uma anotação existente. -->
      @if (data.annotation) {
        <span class="label">Marca-texto</span>
        <div class="swatches">
          <button class="none" [class.selected]="highlighterId() === null" (click)="highlighterId.set(null)" matTooltip="Sem marca-texto">
            <mat-icon>format_color_reset</mat-icon>
          </button>
          @for (h of prefs.highlighters(); track h.id) {
            <app-highlighter-swatch [highlighter]="h" [selected]="highlighterId() === h.id" (click)="highlighterId.set(h.id)" />
          }
        </div>
      }

      <mat-form-field appearance="outline" class="full-width comment">
        <mat-label>Comentário</mat-label>
        <textarea matInput [(ngModel)]="comment" rows="4"></textarea>
      </mat-form-field>

      <div class="sticker-row">
        <span class="label">Figurinha</span>
        @if (sticker(); as s) {
          <app-sticker [sticker]="s" class="current" />
          <button mat-button (click)="pickSticker()">Trocar</button>
          <button mat-button (click)="sticker.set(null)">Remover</button>
        } @else {
          <button mat-stroked-button (click)="pickSticker()"><mat-icon>add_reaction</mat-icon> Adicionar figurinha</button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      @if (data.annotation) {
        <button mat-button class="danger" (click)="ref.close({ action: 'delete' })"><mat-icon>delete</mat-icon> Excluir</button>
      }
      <span class="spacer"></span>
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="save()" [disabled]="!canSave()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    blockquote { margin: 0 0 8px; padding: 10px 14px; border-left: 4px solid var(--mat-sys-primary); max-height: 140px; overflow: auto;
      background: var(--mat-sys-surface-container); border-radius: 0 8px 8px 0; font-style: italic; }
    .label { font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); }
    .swatches { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .none { width: 36px; height: 36px; border-radius: 50%; border: 1px dashed var(--mat-sys-outline); background: none; cursor: pointer;
      display: grid; place-items: center; color: var(--mat-sys-on-surface-variant); }
    .none.selected { outline: 2px solid var(--mat-sys-primary); outline-offset: 2px; }
    .sticker-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .current { --sticker-size: 36px; }
    .danger { color: var(--mat-sys-error); }
  `,
})
export class AnnotationDialog {
  protected readonly data = inject<AnnotationDialogData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<AnnotationDialog, AnnotationDialogResult>>(MatDialogRef);
  protected readonly prefs = inject(PreferencesStore);
  private readonly dialog = inject(MatDialog);

  protected readonly highlighterId = signal<string | null>(
    this.data.annotation ? this.data.annotation.highlighterId : (this.data.draft?.highlighterId ?? this.prefs.activeHighlighter()?.id ?? null),
  );
  protected comment = this.data.annotation?.comment ?? this.data.draft?.comment ?? '';
  protected readonly sticker = signal<StickerRef | null>(this.data.annotation?.sticker ?? this.data.draft?.sticker ?? null);

  protected canSave(): boolean {
    return this.highlighterId() !== null || this.comment.trim() !== '' || this.sticker() !== null;
  }

  protected async pickSticker(): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<StickerPickerDialog, unknown, StickerPickerResult>(StickerPickerDialog, { data: { allowRemove: false }, width: '520px' })
        .afterClosed(),
    );
    if (result && result !== 'remove') this.sticker.set(result);
  }

  protected save(): void {
    this.ref.close({
      action: 'save',
      draft: { highlighterId: this.highlighterId(), comment: this.comment, sticker: this.sticker() },
    });
  }
}

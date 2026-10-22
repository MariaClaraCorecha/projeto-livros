import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Book } from '../../domain/entities';
import { toThumbnail } from '../../core/image';
import { BookCoverComponent } from '../shared/book-cover.component';

export type BookEditResult = Pick<Book, 'title' | 'author' | 'coverDataUrl'>;

@Component({
  selector: 'app-book-edit-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, BookCoverComponent],
  template: `
    <h2 mat-dialog-title class="display-title">Editar informações</h2>
    <mat-dialog-content>
      <div class="layout">
        <div class="cover" [class.dragging]="dragging()"
             (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
          <app-book-cover [title]="title || 'Sem título'" [author]="author" [cover]="cover()" />
          <input #picker type="file" accept="image/*" hidden (change)="pickCover($event)" />
          <div class="cover-overlay">
            <button mat-icon-button type="button" (click)="picker.click()" aria-label="Trocar capa" title="Trocar capa">
              <mat-icon>add_photo_alternate</mat-icon>
            </button>
            @if (cover()) {
              <button mat-icon-button type="button" (click)="cover.set(null)" aria-label="Remover capa" title="Remover capa">
                <mat-icon>delete</mat-icon>
              </button>
            }
          </div>
          <span class="cover-hint">Clique ou arraste uma imagem</span>
        </div>

        <div class="fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Título</mat-label>
            <mat-icon matPrefix>title</mat-icon>
            <input matInput [(ngModel)]="title" required cdkFocusInitial (keydown.enter)="save()" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Autor</mat-label>
            <mat-icon matPrefix>person</mat-icon>
            <input matInput [(ngModel)]="author" (keydown.enter)="save()" />
          </mat-form-field>
          <div class="file-info">
            <mat-icon>description</mat-icon>
            <span class="file-name" [title]="data.fileName">{{ data.fileName }}</span>
            <span class="format">{{ data.format.toUpperCase() }}</span>
          </div>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="save()" [disabled]="!title.trim()"><mat-icon>check</mat-icon> Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .layout { display: flex; gap: 24px; flex-wrap: wrap; padding-top: 4px; }

    .cover { position: relative; width: 150px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;
      border-radius: 12px; transition: transform .2s ease; }
    .cover app-book-cover { border-radius: 4px 10px 10px 4px; transition: box-shadow .2s ease, filter .2s ease; }
    .cover-overlay { position: absolute; inset: 0 0 auto 0; aspect-ratio: 2 / 3; display: flex; align-items: center;
      justify-content: center; gap: 4px; border-radius: 4px 10px 10px 4px; opacity: 0; transition: opacity .2s ease;
      background: color-mix(in srgb, var(--mat-sys-scrim) 45%, transparent); backdrop-filter: blur(2px); }
    .cover-overlay button { color: #fff; background: rgba(255,255,255,.16); }
    .cover:hover .cover-overlay, .cover:focus-within .cover-overlay, .cover.dragging .cover-overlay { opacity: 1; }
    .cover:hover app-book-cover { filter: saturate(.9); }
    .cover.dragging { transform: scale(1.03); }
    .cover.dragging app-book-cover { box-shadow: 0 0 0 3px var(--mat-sys-primary), 0 10px 24px rgba(0,0,0,.25); }
    .cover-hint { font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); text-align: center; }

    .fields { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 4px; }
    .fields mat-icon[matPrefix] { margin: 0 4px 0 12px; color: var(--mat-sys-on-surface-variant); }

    .file-info { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px;
      background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface-variant); }
    .file-info mat-icon { flex-shrink: 0; }
    .file-name { flex: 1; min-width: 0; font: var(--mat-sys-body-small); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .format { flex-shrink: 0; font: var(--mat-sys-label-small); letter-spacing: .08em; padding: 3px 8px; border-radius: 999px;
      background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }

    @media (max-width: 520px) {
      .layout { flex-direction: column; align-items: center; }
      .fields { width: 100%; min-width: 0; }
    }
  `,
})
export class BookEditDialog {
  protected readonly data = inject<Book>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<BookEditDialog, BookEditResult>>(MatDialogRef);
  protected title = this.data.title;
  protected author = this.data.author;
  protected readonly cover = signal(this.data.coverDataUrl);
  protected readonly dragging = signal(false);

  protected async pickCover(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.cover.set(await toThumbnail(file));
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) this.cover.set(await toThumbnail(file));
  }

  protected save(): void {
    if (!this.title.trim()) return;
    this.ref.close({ title: this.title.trim(), author: this.author.trim(), coverDataUrl: this.cover() });
  }
}

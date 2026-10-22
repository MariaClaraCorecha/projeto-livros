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
    <h2 mat-dialog-title>Editar informações</h2>
    <mat-dialog-content>
      <div class="layout">
        <div class="cover">
          <app-book-cover [title]="title" [author]="author" [cover]="cover()" />
          <input #picker type="file" accept="image/*" hidden (change)="pickCover($event)" />
          <button mat-stroked-button (click)="picker.click()"><mat-icon>image</mat-icon> Trocar capa</button>
          @if (cover()) {
            <button mat-button (click)="cover.set(null)">Remover capa</button>
          }
        </div>
        <div class="fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Título</mat-label>
            <input matInput [(ngModel)]="title" required />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Autor</mat-label>
            <input matInput [(ngModel)]="author" />
          </mat-form-field>
          <p class="muted">{{ data.fileName }} · {{ data.format.toUpperCase() }}</p>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="save()" [disabled]="!title.trim()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .layout { display: flex; gap: 20px; flex-wrap: wrap; }
    .cover { width: 130px; display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
    .fields { flex: 1; min-width: 220px; }
  `,
})
export class BookEditDialog {
  protected readonly data = inject<Book>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<BookEditDialog, BookEditResult>>(MatDialogRef);
  protected title = this.data.title;
  protected author = this.data.author;
  protected readonly cover = signal(this.data.coverDataUrl);

  protected async pickCover(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.cover.set(await toThumbnail(file));
  }

  protected save(): void {
    this.ref.close({ title: this.title.trim(), author: this.author.trim(), coverDataUrl: this.cover() });
  }
}

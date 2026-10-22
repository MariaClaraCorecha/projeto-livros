import { Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Book, Shelf } from '../../../domain/entities';
import { BookCoverComponent } from '../../shared/book-cover.component';

export type BookAction =
  | { type: 'favorite' }
  | { type: 'move'; shelfId: string | null }
  | { type: 'edit' }
  | { type: 'delete' };

@Component({
  selector: 'app-book-card',
  imports: [RouterLink, DecimalPipe, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, BookCoverComponent],
  template: `
    <a class="cover-link" [routerLink]="['/ler', book().id]" [attr.aria-label]="'Ler ' + book().title" draggable="false">
      <app-book-cover [title]="book().title" [author]="book().author" [cover]="book().coverDataUrl" />
      <span class="format">{{ book().format }}</span>
      @if (book().favorite) {
        <mat-icon class="fav filled">favorite</mat-icon>
      }
      @if (book().progress > 0) {
        <span class="progress" [style.width.%]="book().progress * 100"></span>
      }
    </a>
    <div class="plank" aria-hidden="true"></div>
    <div class="info">
      <div class="text">
        <span class="title" [title]="book().title">{{ book().title }}</span>
        <span class="author">{{ book().author || 'Autor desconhecido' }}</span>
        @if (book().progress > 0) {
          <span class="percent">{{ book().progress * 100 | number: '1.0-0' }}% lido</span>
        }
      </div>
      <button mat-icon-button class="menu" [matMenuTriggerFor]="menu" aria-label="Ações do livro">
        <mat-icon>more_vert</mat-icon>
      </button>
    </div>

    <mat-menu #menu="matMenu">
      <a mat-menu-item [routerLink]="['/ler', book().id]"><mat-icon>menu_book</mat-icon><span>Ler</span></a>
      <button mat-menu-item (click)="action.emit({ type: 'favorite' })">
        <mat-icon [class.filled]="book().favorite">favorite</mat-icon>
        <span>{{ book().favorite ? 'Remover dos favoritos' : 'Favoritar' }}</span>
      </button>
      <button mat-menu-item [matMenuTriggerFor]="moveMenu"><mat-icon>drive_file_move</mat-icon><span>Mover para</span></button>
      <button mat-menu-item (click)="action.emit({ type: 'edit' })"><mat-icon>edit</mat-icon><span>Editar informações</span></button>
      <mat-divider />
      <button mat-menu-item (click)="action.emit({ type: 'delete' })"><mat-icon>delete</mat-icon><span>Excluir</span></button>
    </mat-menu>

    <mat-menu #moveMenu="matMenu">
      <button mat-menu-item [disabled]="book().shelfId === null" (click)="action.emit({ type: 'move', shelfId: null })">
        <mat-icon>inventory_2</mat-icon><span>Sem estante</span>
      </button>
      @for (s of shelves(); track s.id) {
        <button mat-menu-item [disabled]="book().shelfId === s.id" (click)="action.emit({ type: 'move', shelfId: s.id })">
          <mat-icon [style.color]="s.color">{{ s.icon }}</mat-icon><span>{{ s.name }}</span>
        </button>
      }
    </mat-menu>
  `,
  styleUrl: './book-card.component.scss',
})
export class BookCardComponent {
  readonly book = input.required<Book>();
  readonly shelves = input<Shelf[]>([]);
  readonly action = output<BookAction>();
}

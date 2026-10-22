import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Book, Shelf } from '../../../domain/entities';
import { ImportBookUseCase } from '../../../application/use-cases';
import { BookEditDialog, BookEditResult } from '../../dialogs/book-edit.dialog';
import { confirmDialog } from '../../dialogs/confirm.dialog';
import { ShelfDialog, ShelfDialogResult } from '../../dialogs/shelf.dialog';
import { BookCoverComponent } from '../../shared/book-cover.component';
import { LibrarySort, LibraryStore } from '../../state/library.store';
import { BookAction, BookCardComponent } from './book-card.component';

interface ShelfSection {
  id: string | null;
  shelf: Shelf | null;
  name: string;
  icon: string;
  color: string;
  books: Book[];
}

@Component({
  selector: 'app-library-page',
  imports: [
    RouterLink, DecimalPipe, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder,
    MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule, MatTooltipModule,
    BookCardComponent, BookCoverComponent,
  ],
  templateUrl: './library.page.html',
  styleUrl: './library.page.scss',
})
export class LibraryPage {
  protected readonly library = inject(LibraryStore);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  /** Query param `?estante=` (ligado via withComponentInputBinding). */
  readonly estante = input<string | undefined>();
  protected readonly accept = ImportBookUseCase.accept;
  protected readonly draggingFiles = signal(false);

  protected readonly sorts: { id: LibrarySort; label: string }[] = [
    { id: 'manual', label: 'Minha ordem (arrastar)' },
    { id: 'recent', label: 'Lidos recentemente' },
    { id: 'title', label: 'Título' },
    { id: 'author', label: 'Autor' },
    { id: 'progress', label: 'Progresso' },
  ];

  protected readonly view = computed(() => this.estante() ?? 'todos');
  protected readonly customShelf = computed(() => this.library.shelves().find((s) => s.id === this.view()) ?? null);
  protected readonly canDrag = computed(() => this.library.sort() === 'manual' && !this.library.query());

  protected readonly title = computed(() => {
    switch (this.view()) {
      case 'todos':
        return 'Toda a estante';
      case 'lendo':
        return 'Lendo agora';
      case 'favoritos':
        return 'Favoritos';
      case 'sem-estante':
        return 'Sem estante';
      default:
        return this.customShelf()?.name ?? 'Estante';
    }
  });

  /** Seções (prateleiras) exibidas na visão atual. */
  protected readonly sections = computed<ShelfSection[]>(() => {
    const view = this.view();
    const fromShelf = (s: Shelf): ShelfSection => ({
      id: s.id, shelf: s, name: s.name, icon: s.icon, color: s.color, books: this.library.booksIn(s.id),
    });
    const unshelved: ShelfSection = {
      id: null, shelf: null, name: 'Sem estante', icon: 'inventory_2', color: 'var(--mat-sys-outline)', books: this.library.booksIn(null),
    };
    if (view === 'todos') {
      const all = [...this.library.shelves().map(fromShelf), unshelved];
      return this.library.query() ? all.filter((s) => s.books.length) : all;
    }
    if (view === 'sem-estante') return [unshelved];
    if (this.customShelf()) return [fromShelf(this.customShelf()!)];
    return [];
  });

  /** Visões "inteligentes" (lendo / favoritos): grade simples, sem arrastar. */
  protected readonly smartBooks = computed<Book[] | null>(() => {
    if (this.view() === 'lendo') {
      const ids = new Set(this.library.reading().map((b) => b.id));
      return this.library.filteredBooks().filter((b) => ids.has(b.id));
    }
    if (this.view() === 'favoritos') return this.library.filteredBooks().filter((b) => b.favorite);
    return null;
  });

  protected readonly continueReading = computed(() =>
    this.view() === 'todos' && !this.library.query() ? this.library.reading().slice(0, 6) : [],
  );

  protected readonly empty = computed(() => !this.library.loading() && this.library.books().length === 0);

  /* Importação --------------------------------------------------------- */

  protected onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.importFiles(files);
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.draggingFiles.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    if (event.currentTarget === event.target || !(event.relatedTarget instanceof Node)) this.draggingFiles.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    this.draggingFiles.set(false);
    void this.importFiles(Array.from(event.dataTransfer.files));
  }

  private async importFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    const { imported, failed } = await this.library.import(files, this.customShelf()?.id ?? null);
    if (failed.length) {
      this.snack.open(
        `${imported.length} livro(s) adicionado(s). Não foi possível ler: ${failed.map((f) => f.fileName).join(', ')}`,
        'OK',
        { duration: 8000 },
      );
    } else if (imported.length === 1) {
      this.snack.open(`"${imported[0].title}" foi adicionado à estante.`, 'Ler agora').onAction().subscribe(() => {
        void this.router.navigate(['/ler', imported[0].id]);
      });
    } else {
      this.snack.open(`${imported.length} livros adicionados à estante.`);
    }
  }

  /* Arrastar entre estantes ---------------------------------------------- */

  protected drop(event: CdkDragDrop<string | null, string | null, Book>): void {
    const book = event.item.data;
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    void this.library.moveBook(book.id, event.container.data, event.currentIndex);
  }

  /* Ações -------------------------------------------------------------- */

  protected async onBookAction(book: Book, action: BookAction): Promise<void> {
    switch (action.type) {
      case 'favorite':
        await this.library.updateBook(book, { favorite: !book.favorite });
        break;
      case 'move': {
        await this.library.moveBook(book.id, action.shelfId);
        const name = this.library.shelves().find((s) => s.id === action.shelfId)?.name ?? 'Sem estante';
        this.snack.open(`Movido para "${name}".`);
        break;
      }
      case 'edit': {
        const result = await firstValueFrom(
          this.dialog.open<BookEditDialog, Book, BookEditResult>(BookEditDialog, { data: book, width: '560px' }).afterClosed(),
        );
        if (result) await this.library.updateBook(book, result);
        break;
      }
      case 'delete':
        if (
          await confirmDialog(this.dialog, {
            title: 'Excluir livro?',
            message: `"${book.title}" e todas as suas anotações serão removidos deste navegador.`,
            confirm: 'Excluir',
            danger: true,
          })
        ) {
          await this.library.deleteBook(book.id);
        }
        break;
    }
  }

  protected editShelf(shelf: Shelf): void {
    this.dialog
      .open<ShelfDialog, Shelf, ShelfDialogResult>(ShelfDialog, { data: shelf, width: '440px' })
      .afterClosed()
      .subscribe((result) => result && this.library.updateShelf(shelf, result));
  }

  protected async deleteShelf(shelf: Shelf): Promise<void> {
    const ok = await confirmDialog(this.dialog, {
      title: `Excluir a estante "${shelf.name}"?`,
      message: 'Os livros dela não serão apagados: eles vão para "Sem estante".',
      confirm: 'Excluir estante',
      danger: true,
    });
    if (!ok) return;
    await this.library.deleteShelf(shelf.id);
    if (this.view() === shelf.id) void this.router.navigate(['/']);
  }

  protected trackSection(section: ShelfSection): string {
    return section.id ?? '__none__';
  }
}

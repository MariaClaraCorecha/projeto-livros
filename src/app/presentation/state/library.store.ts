import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Book, Shelf } from '../../domain/entities';
import {
  DeleteBookUseCase,
  DeleteShelfUseCase,
  ImportBookUseCase,
  ListBooksUseCase,
  ListShelvesUseCase,
  MoveBookUseCase,
  SaveShelfUseCase,
  UpdateBookUseCase,
} from '../../application/use-cases';
import { SessionStore } from './session.store';

export type LibrarySort = 'manual' | 'recent' | 'title' | 'author' | 'progress';

export interface ImportResult {
  imported: Book[];
  failed: { fileName: string; reason: string }[];
}

/** Estado da estante: livros, estantes, busca e ordenação. */
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly session = inject(SessionStore);
  private readonly listBooks = inject(ListBooksUseCase);
  private readonly importBook = inject(ImportBookUseCase);
  private readonly updateBookUseCase = inject(UpdateBookUseCase);
  private readonly moveBookUseCase = inject(MoveBookUseCase);
  private readonly deleteBookUseCase = inject(DeleteBookUseCase);
  private readonly listShelves = inject(ListShelvesUseCase);
  private readonly saveShelf = inject(SaveShelfUseCase);
  private readonly deleteShelfUseCase = inject(DeleteShelfUseCase);

  readonly books = signal<Book[]>([]);
  readonly shelves = signal<Shelf[]>([]);
  readonly loading = signal(false);
  readonly importing = signal(0);
  readonly query = signal('');
  readonly sort = signal<LibrarySort>('manual');
  /** Livro sendo arrastado na estante (a barra lateral vira alvo de soltura). */
  readonly draggingBook = signal(false);
  /** Estante da barra lateral sob o ponteiro durante o arraste (`null` = "Sem estante", `undefined` = nenhuma). */
  readonly dropTarget = signal<string | null | undefined>(undefined);

  readonly filteredBooks = computed(() => {
    const q = normalize(this.query());
    const list = q
      ? this.books().filter((b) => normalize(`${b.title} ${b.author} ${b.fileName}`).includes(q))
      : this.books();
    return sortBooks(list, this.sort());
  });

  readonly reading = computed(() =>
    this.books()
      .filter((b) => b.lastOpenedAt && b.progress < 0.99)
      .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
      .slice(0, 12),
  );

  constructor() {
    effect(() => {
      const user = this.session.user();
      untracked(() => {
        this.books.set([]);
        this.shelves.set([]);
        if (user) void this.load();
      });
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [books, shelves] = await Promise.all([this.listBooks.execute(), this.listShelves.execute()]);
      this.books.set(books);
      this.shelves.set(shelves);
    } finally {
      this.loading.set(false);
    }
  }

  booksIn(shelfId: string | null): Book[] {
    return this.filteredBooks().filter((b) => b.shelfId === shelfId);
  }

  /* Livros -------------------------------------------------------------- */

  async import(files: File[], shelfId: string | null): Promise<ImportResult> {
    const result: ImportResult = { imported: [], failed: [] };
    this.importing.update((n) => n + files.length);
    for (const file of files) {
      try {
        const order = this.books().filter((b) => b.shelfId === shelfId).length;
        const book = await this.importBook.execute(file, shelfId, order);
        this.books.update((list) => [...list, book]);
        result.imported.push(book);
      } catch (e) {
        result.failed.push({ fileName: file.name, reason: e instanceof Error ? e.message : String(e) });
      } finally {
        this.importing.update((n) => n - 1);
      }
    }
    return result;
  }

  async updateBook(book: Book, changes: Parameters<UpdateBookUseCase['execute']>[1]): Promise<void> {
    const updated = await this.updateBookUseCase.execute(book, changes);
    this.replace(updated);
  }

  async moveBook(bookId: string, shelfId: string | null, index?: number): Promise<void> {
    const target = index ?? this.books().filter((b) => b.shelfId === shelfId).length;
    this.books.set(await this.moveBookUseCase.execute(this.books(), bookId, shelfId, target));
  }

  async deleteBook(bookId: string): Promise<void> {
    await this.deleteBookUseCase.execute(bookId);
    this.books.update((list) => list.filter((b) => b.id !== bookId));
  }

  /** Mantém a lista em memória em sincronia quando o leitor salva o progresso. */
  patchLocal(bookId: string, changes: Partial<Book>): void {
    this.books.update((list) => list.map((b) => (b.id === bookId ? { ...b, ...changes } : b)));
  }

  /* Estantes ------------------------------------------------------------ */

  async createShelf(data: Pick<Shelf, 'name' | 'color' | 'icon'>): Promise<Shelf> {
    const shelf = await this.saveShelf.create(data, this.shelves().length);
    this.shelves.update((list) => [...list, shelf]);
    return shelf;
  }

  async updateShelf(shelf: Shelf, data: Partial<Pick<Shelf, 'name' | 'color' | 'icon'>>): Promise<void> {
    const updated = await this.saveShelf.update(shelf, data);
    this.shelves.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
  }

  async reorderShelves(shelves: Shelf[]): Promise<void> {
    this.shelves.set(await this.saveShelf.reorder(shelves));
  }

  async deleteShelf(shelfId: string): Promise<void> {
    this.books.set(await this.deleteShelfUseCase.execute(shelfId, this.books()));
    this.shelves.update((list) => list.filter((s) => s.id !== shelfId));
  }

  private replace(book: Book): void {
    this.books.update((list) => list.map((b) => (b.id === book.id ? book : b)));
  }
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function sortBooks(books: Book[], sort: LibrarySort): Book[] {
  const list = [...books];
  const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
  switch (sort) {
    case 'manual':
      return list.sort((a, b) => a.order - b.order);
    case 'recent':
      return list.sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt));
    case 'title':
      return list.sort((a, b) => collator.compare(a.title, b.title));
    case 'author':
      return list.sort((a, b) => collator.compare(a.author, b.author) || collator.compare(a.title, b.title));
    case 'progress':
      return list.sort((a, b) => b.progress - a.progress);
  }
}

import { inject, Injectable } from '@angular/core';
import { Book, SUPPORTED_EXTENSIONS } from '../../domain/entities';
import { AnnotationRepository, BookRepository } from '../../domain/repositories';
import { BookMetadataExtractor } from '../ports';
import { CurrentUser, newId } from './current-user';

export class UnsupportedBookError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" não é um EPUB, PDF ou MOBI válido.`);
  }
}

@Injectable({ providedIn: 'root' })
export class ListBooksUseCase {
  private readonly books = inject(BookRepository);
  private readonly user = inject(CurrentUser);

  execute(): Promise<Book[]> {
    return this.books.listByOwner(this.user.id());
  }
}

@Injectable({ providedIn: 'root' })
export class ImportBookUseCase {
  private readonly books = inject(BookRepository);
  private readonly extractor = inject(BookMetadataExtractor);
  private readonly user = inject(CurrentUser);

  static readonly accept = Object.keys(SUPPORTED_EXTENSIONS).map((ext) => `.${ext}`).join(',');

  async execute(file: File, shelfId: string | null, order: number): Promise<Book> {
    const format = await this.extractor.detectFormat(file);
    if (!format) throw new UnsupportedBookError(file.name);

    const fallbackTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const metadata = await this.extractor
      .extract(file, format)
      .catch(() => ({ title: '', author: '', coverDataUrl: null }));

    const book: Book = {
      id: newId(),
      ownerId: this.user.id(),
      title: metadata.title.trim() || fallbackTitle,
      author: metadata.author.trim(),
      format,
      fileName: file.name,
      size: file.size,
      coverDataUrl: metadata.coverDataUrl,
      shelfId,
      order,
      favorite: false,
      progress: 0,
      lastLocation: null,
      engineCache: null,
      addedAt: Date.now(),
      lastOpenedAt: null,
    };
    await this.books.save(book, file);
    return book;
  }
}

@Injectable({ providedIn: 'root' })
export class UpdateBookUseCase {
  private readonly books = inject(BookRepository);

  async execute(book: Book, changes: Partial<Pick<Book, 'title' | 'author' | 'favorite' | 'coverDataUrl'>>): Promise<Book> {
    const updated: Book = { ...book, ...changes };
    await this.books.save(updated);
    return updated;
  }
}

/** Move um livro para uma estante (ou para fora delas) numa posição e renumera a estante destino. */
@Injectable({ providedIn: 'root' })
export class MoveBookUseCase {
  private readonly books = inject(BookRepository);

  async execute(all: readonly Book[], bookId: string, targetShelfId: string | null, targetIndex: number): Promise<Book[]> {
    const moving = all.find((b) => b.id === bookId);
    if (!moving) return [...all];

    const target = all
      .filter((b) => b.shelfId === targetShelfId && b.id !== bookId)
      .sort((a, b) => a.order - b.order);
    const index = Math.max(0, Math.min(targetIndex, target.length));
    target.splice(index, 0, { ...moving, shelfId: targetShelfId });

    const changed = target.map((b, order) => ({ ...b, order }));
    await this.books.saveMany(changed);

    const byId = new Map(changed.map((b) => [b.id, b]));
    return all.map((b) => byId.get(b.id) ?? b);
  }
}

@Injectable({ providedIn: 'root' })
export class DeleteBookUseCase {
  private readonly books = inject(BookRepository);
  private readonly annotations = inject(AnnotationRepository);

  async execute(bookId: string): Promise<void> {
    await this.annotations.deleteByBook(bookId);
    await this.books.delete(bookId);
  }
}

@Injectable({ providedIn: 'root' })
export class OpenBookUseCase {
  private readonly books = inject(BookRepository);
  private readonly user = inject(CurrentUser);

  async execute(bookId: string): Promise<{ book: Book; file: Blob }> {
    const book = await this.books.get(bookId);
    if (!book || book.ownerId !== this.user.id()) throw new Error('Livro não encontrado.');
    const file = await this.books.getFile(bookId);
    if (!file) throw new Error('Arquivo do livro não encontrado.');
    const opened: Book = { ...book, lastOpenedAt: Date.now() };
    await this.books.save(opened);
    return { book: opened, file };
  }
}

@Injectable({ providedIn: 'root' })
export class SaveReadingProgressUseCase {
  private readonly books = inject(BookRepository);

  async execute(bookId: string, progress: { location?: string; progress?: number; cache?: string }): Promise<void> {
    const book = await this.books.get(bookId);
    if (!book) return;
    await this.books.save({
      ...book,
      lastLocation: progress.location ?? book.lastLocation,
      progress: progress.progress ?? book.progress,
      engineCache: progress.cache ?? book.engineCache,
    });
  }
}

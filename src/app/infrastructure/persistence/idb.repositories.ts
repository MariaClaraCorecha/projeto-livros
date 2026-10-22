import { inject, Injectable } from '@angular/core';
import { Annotation, Book, CustomSticker, ReaderPreferences, Shelf } from '../../domain/entities';
import {
  AnnotationRepository,
  BookRepository,
  PreferencesRepository,
  ShelfRepository,
  StickerRepository,
} from '../../domain/repositories';
import { IdbDatabase } from './idb.database';

/*
 * IndexedDB guarda objetos via structured clone; os sinais e classes não entram aqui,
 * apenas os objetos simples do domínio. O `structuredClone` evita gravar proxies/referências.
 */
const plain = <T>(value: T): T => structuredClone(value);

@Injectable()
export class IdbBookRepository extends BookRepository {
  private readonly database = inject(IdbDatabase);

  async listByOwner(ownerId: string): Promise<Book[]> {
    return (await this.database.get()).getAllFromIndex('books', 'ownerId', ownerId);
  }

  async get(id: string): Promise<Book | undefined> {
    return (await this.database.get()).get('books', id);
  }

  async save(book: Book, file?: Blob): Promise<void> {
    const db = await this.database.get();
    const tx = db.transaction(['books', 'bookFiles'], 'readwrite');
    await Promise.all([
      tx.objectStore('books').put(plain(book)),
      file ? tx.objectStore('bookFiles').put({ bookId: book.id, blob: file }) : Promise.resolve(),
      tx.done,
    ]);
  }

  async saveMany(books: Book[]): Promise<void> {
    const db = await this.database.get();
    const tx = db.transaction('books', 'readwrite');
    await Promise.all([...books.map((b) => tx.store.put(plain(b))), tx.done]);
  }

  async getFile(bookId: string): Promise<Blob | undefined> {
    return (await (await this.database.get()).get('bookFiles', bookId))?.blob;
  }

  async delete(id: string): Promise<void> {
    const db = await this.database.get();
    const tx = db.transaction(['books', 'bookFiles'], 'readwrite');
    await Promise.all([tx.objectStore('books').delete(id), tx.objectStore('bookFiles').delete(id), tx.done]);
  }
}

@Injectable()
export class IdbShelfRepository extends ShelfRepository {
  private readonly database = inject(IdbDatabase);

  async listByOwner(ownerId: string): Promise<Shelf[]> {
    return (await this.database.get()).getAllFromIndex('shelves', 'ownerId', ownerId);
  }

  async save(shelf: Shelf): Promise<void> {
    await (await this.database.get()).put('shelves', plain(shelf));
  }

  async saveMany(shelves: Shelf[]): Promise<void> {
    const db = await this.database.get();
    const tx = db.transaction('shelves', 'readwrite');
    await Promise.all([...shelves.map((s) => tx.store.put(plain(s))), tx.done]);
  }

  async delete(id: string): Promise<void> {
    await (await this.database.get()).delete('shelves', id);
  }
}

@Injectable()
export class IdbAnnotationRepository extends AnnotationRepository {
  private readonly database = inject(IdbDatabase);

  async listByBook(bookId: string): Promise<Annotation[]> {
    return (await this.database.get()).getAllFromIndex('annotations', 'bookId', bookId);
  }

  async save(annotation: Annotation): Promise<void> {
    await (await this.database.get()).put('annotations', plain(annotation));
  }

  async delete(id: string): Promise<void> {
    await (await this.database.get()).delete('annotations', id);
  }

  async deleteByBook(bookId: string): Promise<void> {
    const db = await this.database.get();
    const tx = db.transaction('annotations', 'readwrite');
    const keys = await tx.store.index('bookId').getAllKeys(bookId);
    await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
  }
}

@Injectable()
export class IdbPreferencesRepository extends PreferencesRepository {
  private readonly database = inject(IdbDatabase);

  async get(ownerId: string): Promise<ReaderPreferences | undefined> {
    return (await this.database.get()).get('preferences', ownerId);
  }

  async save(preferences: ReaderPreferences): Promise<void> {
    await (await this.database.get()).put('preferences', plain(preferences));
  }
}

@Injectable()
export class IdbStickerRepository extends StickerRepository {
  private readonly database = inject(IdbDatabase);

  async listByOwner(ownerId: string): Promise<CustomSticker[]> {
    return (await this.database.get()).getAllFromIndex('stickers', 'ownerId', ownerId);
  }

  async save(sticker: CustomSticker): Promise<void> {
    await (await this.database.get()).put('stickers', plain(sticker));
  }

  async delete(id: string): Promise<void> {
    await (await this.database.get()).delete('stickers', id);
  }
}

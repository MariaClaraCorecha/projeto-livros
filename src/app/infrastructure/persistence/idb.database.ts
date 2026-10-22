import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Annotation, Book, CustomSticker, ReaderPreferences, Shelf } from '../../domain/entities';

interface BookshelfDb extends DBSchema {
  books: { key: string; value: Book; indexes: { ownerId: string } };
  bookFiles: { key: string; value: { bookId: string; blob: Blob } };
  shelves: { key: string; value: Shelf; indexes: { ownerId: string } };
  annotations: { key: string; value: Annotation; indexes: { bookId: string } };
  preferences: { key: string; value: ReaderPreferences };
  stickers: { key: string; value: CustomSticker; indexes: { ownerId: string } };
}

export type BookshelfDatabase = IDBPDatabase<BookshelfDb>;

/** Abre (uma única vez) o banco IndexedDB local onde livros e anotações ficam guardados. */
@Injectable({ providedIn: 'root' })
export class IdbDatabase {
  private db?: Promise<BookshelfDatabase>;

  get(): Promise<BookshelfDatabase> {
    this.db ??= openDB<BookshelfDb>('estante-de-livros', 1, {
      upgrade(db) {
        db.createObjectStore('books', { keyPath: 'id' }).createIndex('ownerId', 'ownerId');
        db.createObjectStore('bookFiles', { keyPath: 'bookId' });
        db.createObjectStore('shelves', { keyPath: 'id' }).createIndex('ownerId', 'ownerId');
        db.createObjectStore('annotations', { keyPath: 'id' }).createIndex('bookId', 'bookId');
        db.createObjectStore('preferences', { keyPath: 'ownerId' });
        db.createObjectStore('stickers', { keyPath: 'id' }).createIndex('ownerId', 'ownerId');
      },
    });
    return this.db;
  }
}

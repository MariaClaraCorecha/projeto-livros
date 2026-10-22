import { Signal } from '@angular/core';
import { Annotation, Book, CustomSticker, ReaderPreferences, Shelf, User } from '../entities';

/*
 * Portas (contratos) do domínio. As implementações ficam em `infrastructure/` e são
 * ligadas via injeção de dependência em `infrastructure/infrastructure.providers.ts`.
 * Classes abstratas são usadas como tokens de DI do Angular.
 */

export abstract class AuthGateway {
  abstract readonly user: Signal<User | null>;

  abstract readonly ready: Signal<boolean>;
  abstract readonly googleAvailable: boolean;
  abstract signInWithGoogle(): Promise<User>;
  abstract signInAsGuest(): Promise<User>;
  abstract signOut(): Promise<void>;
}

export abstract class BookRepository {
  abstract listByOwner(ownerId: string): Promise<Book[]>;
  abstract get(id: string): Promise<Book | undefined>;
  abstract save(book: Book, file?: Blob): Promise<void>;
  abstract saveMany(books: Book[]): Promise<void>;
  abstract getFile(bookId: string): Promise<Blob | undefined>;
  abstract delete(id: string): Promise<void>;
}

export abstract class ShelfRepository {
  abstract listByOwner(ownerId: string): Promise<Shelf[]>;
  abstract save(shelf: Shelf): Promise<void>;
  abstract saveMany(shelves: Shelf[]): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export abstract class AnnotationRepository {
  abstract listByBook(bookId: string): Promise<Annotation[]>;
  abstract save(annotation: Annotation): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract deleteByBook(bookId: string): Promise<void>;
}

export abstract class PreferencesRepository {
  abstract get(ownerId: string): Promise<ReaderPreferences | undefined>;
  abstract save(preferences: ReaderPreferences): Promise<void>;
}

export abstract class StickerRepository {
  abstract listByOwner(ownerId: string): Promise<CustomSticker[]>;
  abstract save(sticker: CustomSticker): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

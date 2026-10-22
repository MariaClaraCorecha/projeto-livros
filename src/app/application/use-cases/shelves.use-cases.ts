import { inject, Injectable } from '@angular/core';
import { Book, Shelf } from '../../domain/entities';
import { BookRepository, ShelfRepository } from '../../domain/repositories';
import { CurrentUser, newId } from './current-user';

@Injectable({ providedIn: 'root' })
export class ListShelvesUseCase {
  private readonly shelves = inject(ShelfRepository);
  private readonly user = inject(CurrentUser);

  async execute(): Promise<Shelf[]> {
    const list = await this.shelves.listByOwner(this.user.id());
    return list.sort((a, b) => a.order - b.order);
  }
}

@Injectable({ providedIn: 'root' })
export class SaveShelfUseCase {
  private readonly shelves = inject(ShelfRepository);
  private readonly user = inject(CurrentUser);

  async create(data: Pick<Shelf, 'name' | 'color' | 'icon'>, order: number): Promise<Shelf> {
    const shelf: Shelf = { id: newId(), ownerId: this.user.id(), createdAt: Date.now(), order, ...data };
    await this.shelves.save(shelf);
    return shelf;
  }

  async update(shelf: Shelf, data: Partial<Pick<Shelf, 'name' | 'color' | 'icon'>>): Promise<Shelf> {
    const updated = { ...shelf, ...data };
    await this.shelves.save(updated);
    return updated;
  }

  async reorder(shelves: readonly Shelf[]): Promise<Shelf[]> {
    const ordered = shelves.map((s, order) => ({ ...s, order }));
    await this.shelves.saveMany(ordered);
    return ordered;
  }
}

/** Exclui a estante. Os livros dela não são apagados: vão para "Sem estante". */
@Injectable({ providedIn: 'root' })
export class DeleteShelfUseCase {
  private readonly shelves = inject(ShelfRepository);
  private readonly books = inject(BookRepository);

  async execute(shelfId: string, books: readonly Book[]): Promise<Book[]> {
    const unshelvedCount = books.filter((b) => b.shelfId === null).length;
    const moved = books
      .filter((b) => b.shelfId === shelfId)
      .sort((a, b) => a.order - b.order)
      .map((b, i) => ({ ...b, shelfId: null, order: unshelvedCount + i }));
    await this.books.saveMany(moved);
    await this.shelves.delete(shelfId);
    const byId = new Map(moved.map((b) => [b.id, b]));
    return books.map((b) => byId.get(b.id) ?? b);
  }
}

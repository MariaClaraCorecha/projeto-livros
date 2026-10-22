import { TestBed } from '@angular/core/testing';
import { Book } from '../../domain/entities';
import { AnnotationRepository, BookRepository, ShelfRepository } from '../../domain/repositories';
import { MoveBookUseCase } from './books.use-cases';
import { DeleteShelfUseCase } from './shelves.use-cases';

const book = (id: string, shelfId: string | null, order: number): Book => ({
  id, ownerId: 'u', title: id, author: '', format: 'epub', fileName: `${id}.epub`, size: 1, coverDataUrl: null, shelfId, order,
  favorite: false, progress: 0, lastLocation: null, engineCache: null, addedAt: 0, lastOpenedAt: null,
});

describe('casos de uso da estante', () => {
  const saved: Book[][] = [];

  beforeEach(() => {
    saved.length = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: BookRepository, useValue: { saveMany: async (b: Book[]) => void saved.push(b) } },
        { provide: ShelfRepository, useValue: { delete: async () => undefined } },
        { provide: AnnotationRepository, useValue: {} },
      ],
    });
  });

  it('move um livro para outra estante na posição escolhida e renumera', async () => {
    const all = [book('a', 's1', 0), book('b', 's1', 1), book('c', 's2', 0), book('d', 's2', 1)];
    const result = await TestBed.inject(MoveBookUseCase).execute(all, 'a', 's2', 1);
    const s2 = result.filter((b) => b.shelfId === 's2').sort((x, y) => x.order - y.order).map((b) => b.id);
    expect(s2).toEqual(['c', 'a', 'd']);
    expect(saved[0].map((b) => b.id)).toEqual(['c', 'a', 'd']);
  });

  it('reordena dentro da mesma estante', async () => {
    const all = [book('a', null, 0), book('b', null, 1), book('c', null, 2)];
    const result = await TestBed.inject(MoveBookUseCase).execute(all, 'c', null, 0);
    expect([...result].sort((x, y) => x.order - y.order).map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('excluir estante manda os livros para "Sem estante" sem apagá-los', async () => {
    const all = [book('a', 's1', 0), book('b', null, 0)];
    const result = await TestBed.inject(DeleteShelfUseCase).execute('s1', all);
    expect(result.find((b) => b.id === 'a')).toMatchObject({ shelfId: null, order: 1 });
    expect(result.length).toBe(2);
  });
});

import { Annotation, Highlighter } from '../../domain/entities';
import { decorate, offsetsToRange, rangeToOffsets, unwrapAnnotations, wrapRange } from './dom-annotations';

function setup(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

const annotation = (id: string): Annotation => ({
  id, ownerId: 'u', bookId: 'b', anchor: { type: 'text', page: 0, start: 0, end: 0 }, quote: '', highlighterId: 'h',
  comment: 'nota', sticker: null, locationLabel: '', sortKey: 0, createdAt: 0, updatedAt: 0,
});
const yellow: Highlighter = { id: 'h', name: 'Amarelo', color: '#ffd43b', style: 'highlight', opacity: 0.5, builtIn: true };

describe('dom-annotations', () => {
  it('converte intervalo ↔ deslocamentos de texto', () => {
    const root = setup('<p>Olá <b>mundo</b> bonito</p><p>Segunda linha</p>');
    const range = offsetsToRange(root, 4, 15)!;
    expect(range.toString()).toBe('mundo bonit');
    expect(rangeToOffsets(root, range)).toEqual({ start: 4, end: 15 });
  });

  it('marca um trecho que atravessa elementos sem alterar o texto', () => {
    const root = setup('<p>Olá <b>mundo</b> bonito</p>');
    const before = root.textContent;
    const marks = wrapRange(offsetsToRange(root, 2, 12)!, 'a1');
    expect(marks.length).toBe(3);
    expect(marks.map((m) => m.textContent).join('')).toBe('á mundo bo');
    expect(root.textContent).toBe(before);
    // Os deslocamentos continuam válidos depois de marcar.
    expect(offsetsToRange(root, 4, 9)!.toString()).toBe('mundo');
  });

  it('aplica estilo, comentário e figurinha; e remove tudo depois', () => {
    const root = setup('<p>Um trecho importante aqui.</p>');
    const marks = wrapRange(offsetsToRange(root, 3, 20)!, 'a1');
    decorate(marks, { annotation: annotation('a1'), highlighter: yellow, sticker: { kind: 'emoji', value: '⭐' } });
    expect(marks[0].style.backgroundColor).toContain('rgba(255, 212, 59');
    expect(marks[0].title).toBe('nota');
    const sticker = root.querySelector<HTMLElement>('span.bk-sticker')!;
    expect(sticker.dataset['content']).toBe('⭐');
    expect(sticker.textContent).toBe(''); // figurinha não altera os deslocamentos
    expect(root.textContent).toBe('Um trecho importante aqui.');

    unwrapAnnotations(root);
    expect(root.querySelector('mark, .bk-sticker')).toBeNull();
    expect(root.innerHTML).toBe('<p>Um trecho importante aqui.</p>');
  });

  it('remove só a anotação pedida', () => {
    const root = setup('<p>abcdefghij</p>');
    wrapRange(offsetsToRange(root, 0, 3)!, 'a1');
    wrapRange(offsetsToRange(root, 5, 8)!, 'a2');
    unwrapAnnotations(root, 'a1');
    expect(root.querySelectorAll('mark').length).toBe(1);
    expect(root.querySelector('mark')!.dataset['annId']).toBe('a2');
  });
});

import { parseStickerPack, STICKER_PACK_FORMAT } from './stickers.use-cases';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('parseStickerPack', () => {
  it('lê as figurinhas válidas e ignora o resto', () => {
    const json = JSON.stringify({
      format: STICKER_PACK_FORMAT,
      version: 1,
      name: 'Pacote',
      stickers: [
        { name: ' Gato ', dataUrl: PNG },
        { name: '', dataUrl: 'data:image/svg+xml;charset=utf-8,<svg/>' },
        { name: 'Script', dataUrl: 'javascript:alert(1)' },
        { name: 'Sem imagem' },
        null,
      ],
    });
    expect(parseStickerPack(json)).toEqual([
      { name: 'Gato', dataUrl: PNG },
      { name: 'Figurinha', dataUrl: 'data:image/svg+xml;charset=utf-8,<svg/>' },
    ]);
  });

  it('rejeita arquivos que não são pacotes', () => {
    expect(() => parseStickerPack('não é json')).toThrowError(/pacote de figurinhas/);
    expect(() => parseStickerPack(JSON.stringify({ stickers: [] }))).toThrowError(/pacote de figurinhas/);
  });
});

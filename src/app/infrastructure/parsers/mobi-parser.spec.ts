import { SAMPLE_MOBI_BASE64 } from '../../../testing/sample-mobi';
import { MobiError, parseMobi } from './mobi-parser';

function sampleBlob(): Blob {
  const bytes = Uint8Array.from(atob(SAMPLE_MOBI_BASE64), (c) => c.charCodeAt(0));
  return new Blob([bytes]);
}

describe('parseMobi', () => {
  it('lê título e autor do cabeçalho MOBI/EXTH', async () => {
    const mobi = await parseMobi(sampleBlob(), { withContent: false });
    expect(mobi.title).toBe('O Leitor de MOBI');
    expect(mobi.author).toBe('Carlos Teste');
    expect(mobi.html).toBe('');
  });

  it('descomprime o texto PalmDOC preservando acentos', async () => {
    const mobi = await parseMobi(sampleBlob(), { withContent: true });
    expect(mobi.html).toContain('<h1>Primeira parte</h1>');
    expect(mobi.html).toContain('Parágrafo 1: Era uma vez um leitor');
    expect(mobi.html).toContain('Parágrafo 30:');
    expect(mobi.html).toContain('class="mobi-pagebreak"');
    expect(mobi.html).not.toContain('mbp:');
  });

  it('rejeita arquivos que não são MOBI', async () => {
    await expect(parseMobi(new Blob([new Uint8Array(100)]), { withContent: false })).rejects.toBeInstanceOf(MobiError);
  });
});

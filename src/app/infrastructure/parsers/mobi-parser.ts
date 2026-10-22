/**
 * Leitor de arquivos MOBI/AZW/PRC (formato Mobipocket, sem DRM).
 *
 * Estrutura: banco PalmDB → registro 0 (cabeçalhos PalmDOC + MOBI + EXTH) →
 * registros de texto comprimidos (PalmDOC LZ77 ou HUFF/CDIC) → registros de imagens.
 */

export interface MobiBook {
  title: string;
  author: string;
  /** HTML do livro (já sanitizado de scripts), com imagens apontando para blob URLs. */
  html: string;
  coverBlob: Blob | null;
  /** Revoga os blob URLs criados para as imagens. */
  dispose(): void;
}

export class MobiError extends Error {}

const textDecoder = (encoding: number) => new TextDecoder(encoding === 65001 ? 'utf-8' : 'windows-1252');

export async function parseMobi(blob: Blob, options: { withContent: boolean }): Promise<MobiBook> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (latin1(buffer, 60, 8) !== 'BOOKMOBI' && latin1(buffer, 60, 8) !== 'TEXtREAd') {
    throw new MobiError('Arquivo não é um MOBI válido.');
  }

  const recordCount = view.getUint16(76);
  const offsets: number[] = [];
  for (let i = 0; i < recordCount; i++) offsets.push(view.getUint32(78 + i * 8));
  offsets.push(buffer.byteLength);
  const record = (i: number) => buffer.subarray(offsets[i], offsets[i + 1]);

  const r0 = record(0);
  const h = new DataView(r0.buffer, r0.byteOffset, r0.byteLength);
  const compression = h.getUint16(0);
  const textRecordCount = h.getUint16(8);
  const encryption = h.getUint16(12);
  if (encryption !== 0) throw new MobiError('Este arquivo MOBI está protegido por DRM e não pode ser aberto.');

  const hasMobiHeader = latin1(r0, 16, 4) === 'MOBI';
  const headerLength = hasMobiHeader ? h.getUint32(20) : 0;
  const encoding = hasMobiHeader ? h.getUint32(28) : 1252;
  const decoder = textDecoder(encoding);
  const firstImage = hasMobiHeader ? h.getUint32(108) : 0xffffffff;
  const huffRecord = hasMobiHeader ? h.getUint32(112) : 0;
  const huffCount = hasMobiHeader ? h.getUint32(116) : 0;
  const exthFlags = hasMobiHeader ? h.getUint32(128) : 0;
  const extraFlags = hasMobiHeader && headerLength >= 0xe4 ? h.getUint16(0xf2) : 0;

  let title = latin1(buffer, 0, 32).replace(/\0.*$/, '').replace(/_/g, ' ');
  if (hasMobiHeader) {
    const nameOffset = h.getUint32(84);
    const nameLength = h.getUint32(88);
    if (nameOffset + nameLength <= r0.length) title = decoder.decode(r0.subarray(nameOffset, nameOffset + nameLength));
  }

  // EXTH: metadados extras (autor, capa, título atualizado…)
  let author = '';
  let coverOffset: number | null = null;
  if (exthFlags & 0x40) {
    const start = 16 + headerLength;
    if (latin1(r0, start, 4) === 'EXTH') {
      const count = h.getUint32(start + 8);
      let pos = start + 12;
      const authors: string[] = [];
      for (let i = 0; i < count && pos + 8 <= r0.length; i++) {
        const type = h.getUint32(pos);
        const len = h.getUint32(pos + 4);
        const data = r0.subarray(pos + 8, pos + len);
        if (type === 100) authors.push(decoder.decode(data));
        else if (type === 503) title = decoder.decode(data);
        else if (type === 201 && data.length >= 4) coverOffset = new DataView(data.buffer, data.byteOffset).getUint32(0);
        pos += len;
      }
      author = authors.join(', ');
    }
  }

  const imageRecord = (index: number): Uint8Array | null => {
    const i = firstImage + index;
    if (firstImage === 0xffffffff || i >= recordCount) return null;
    const data = record(i);
    return imageMime(data) ? data : null;
  };

  let coverBlob: Blob | null = null;
  if (coverOffset !== null && coverOffset !== 0xffffffff) {
    const data = imageRecord(coverOffset);
    if (data) coverBlob = new Blob([data.slice()], { type: imageMime(data)! });
  }

  if (!options.withContent) return { title, author, html: '', coverBlob, dispose: () => undefined };

  // Texto
  const strip = trailingEntriesRemover(extraFlags);
  let decompress: (data: Uint8Array) => Uint8Array;
  if (compression === 1) decompress = (d) => d;
  else if (compression === 2) decompress = palmDocDecompress;
  else if (compression === 17480) decompress = huffCdic(record, huffRecord, huffCount);
  else throw new MobiError(`Compressão MOBI não suportada (${compression}).`);

  const parts: Uint8Array[] = [];
  for (let i = 1; i <= textRecordCount && i < recordCount; i++) parts.push(decompress(strip(record(i))));
  const raw = decoder.decode(concat(parts));

  // Imagens: <img recindex="00001"> referencia (firstImage + recindex - 1)
  const urls: string[] = [];
  const html = sanitize(raw, (recindex) => {
    const data = imageRecord(recindex - 1);
    if (!data) return null;
    const url = URL.createObjectURL(new Blob([data.slice()], { type: imageMime(data)! }));
    urls.push(url);
    return url;
  });

  return { title, author, html, coverBlob, dispose: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}

/* ------------------------------------------------------------------ */

function latin1(data: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...data.subarray(start, start + length));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

function imageMime(data: Uint8Array): string | null {
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png';
  if (data[0] === 0x47 && data[1] === 0x49) return 'image/gif';
  if (data[0] === 0x42 && data[1] === 0x4d) return 'image/bmp';
  return null;
}

/** Remove as "trailing entries" que alguns registros de texto carregam no final. */
function trailingEntriesRemover(extraFlags: number): (data: Uint8Array) => Uint8Array {
  const multibyte = extraFlags & 1;
  let entries = 0;
  for (let f = extraFlags >>> 1; f; f >>>= 1) entries += f & 1;
  return (data) => {
    for (let i = 0; i < entries; i++) {
      let size = 0;
      for (const byte of data.subarray(-4)) {
        if (byte & 0x80) size = 0;
        size = (size << 7) | (byte & 0x7f);
      }
      data = data.subarray(0, data.length - size);
    }
    if (multibyte) data = data.subarray(0, data.length - ((data[data.length - 1] & 3) + 1));
    return data;
  };
}

/** Descompressão PalmDOC (variante simples de LZ77). */
function palmDocDecompress(input: Uint8Array): Uint8Array {
  const out = new Uint8Array(input.length * 8);
  let o = 0;
  for (let i = 0; i < input.length; ) {
    const c = input[i++];
    if (c >= 1 && c <= 8) {
      for (let j = 0; j < c && i < input.length; j++) out[o++] = input[i++];
    } else if (c < 0x80) {
      out[o++] = c;
    } else if (c >= 0xc0) {
      out[o++] = 0x20;
      out[o++] = c ^ 0x80;
    } else if (i < input.length) {
      const pair = (c << 8) | input[i++];
      const distance = (pair >> 3) & 0x7ff;
      const length = (pair & 7) + 3;
      for (let j = 0; j < length; j++) {
        out[o] = out[o - distance];
        o++;
      }
    }
  }
  return out.subarray(0, o);
}

/** Descompressão HUFF/CDIC (usada por arquivos gerados pelo kindlegen). */
function huffCdic(record: (i: number) => Uint8Array, huffIndex: number, huffCount: number) {
  const u32 = (d: Uint8Array, at: number) => new DataView(d.buffer, d.byteOffset).getUint32(at);
  const u16 = (d: Uint8Array, at: number) => new DataView(d.buffer, d.byteOffset).getUint16(at);

  const huff = record(huffIndex);
  if (latin1(huff, 0, 4) !== 'HUFF') throw new MobiError('Cabeçalho HUFF inválido.');
  const off1 = u32(huff, 8);
  const off2 = u32(huff, 12);
  const table1 = Array.from({ length: 256 }, (_, i) => {
    const x = u32(huff, off1 + i * 4);
    return [x & 0x80, x & 0x1f, x >>> 8] as const;
  });
  const table2: [number, number][] = [[0, 0]];
  for (let i = 0; i < 32; i++) table2.push([u32(huff, off2 + i * 8), u32(huff, off2 + i * 8 + 4)]);

  const dictionary: [Uint8Array, boolean][] = [];
  for (let r = 1; r < huffCount; r++) {
    const cdic = record(huffIndex + r);
    if (latin1(cdic, 0, 4) !== 'CDIC') throw new MobiError('Cabeçalho CDIC inválido.');
    const headerLen = u32(cdic, 4);
    const total = u32(cdic, 8);
    const codeLen = u32(cdic, 12);
    const n = Math.min(1 << codeLen, total - dictionary.length);
    const body = cdic.subarray(headerLen);
    for (let i = 0; i < n; i++) {
      const offset = u16(body, i * 2);
      const x = u16(body, offset);
      dictionary.push([body.subarray(offset + 2, offset + 2 + (x & 0x7fff)), (x & 0x8000) !== 0]);
    }
  }

  const read32 = (data: Uint8Array, bitPos: number): number => {
    const byte = bitPos >> 3;
    const shift = bitPos & 7;
    let v = 0n;
    for (let i = 0; i < 5; i++) v = (v << 8n) | BigInt(data[byte + i] ?? 0);
    return Number((v >> BigInt(8 - shift)) & 0xffffffffn);
  };

  const decompress = (data: Uint8Array): Uint8Array => {
    const parts: Uint8Array[] = [];
    const bitLength = data.length * 8;
    for (let pos = 0; pos < bitLength; ) {
      const bits = read32(data, pos);
      let [found, codeLen, value] = table1[bits >>> 24];
      if (!found) {
        while (bits >>> (32 - codeLen) < table2[codeLen][0]) codeLen++;
        value = table2[codeLen][1];
      }
      pos += codeLen;
      if (pos > bitLength) break;
      const code = value - (bits >>> (32 - codeLen));
      let [result, done] = dictionary[code];
      if (!done) {
        result = decompress(result);
        dictionary[code] = [result, true];
      }
      parts.push(result);
    }
    return concat(parts);
  };
  return decompress;
}

/** Converte o HTML do MOBI num fragmento seguro (sem scripts, eventos ou estilos externos). */
function sanitize(raw: string, imageUrl: (recindex: number) => string | null): string {
  const prepared = raw
    .replace(/<mbp:pagebreak\s*\/?>/gi, '<div class="mobi-pagebreak"></div>')
    .replace(/<\/?mbp:[^>]*>/gi, '');
  const doc = new DOMParser().parseFromString(prepared, 'text/html');
  doc.querySelectorAll('script, style, link, iframe, object, embed, form, meta').forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || (name === 'href' && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'IMG') {
      const rec = Number(el.getAttribute('recindex'));
      const url = rec ? imageUrl(rec) : null;
      if (url) el.setAttribute('src', url);
      else el.remove();
    }
    // Atributos de apresentação antigos (font size, align) atrapalham as preferências do leitor.
    if (el.tagName === 'FONT') el.removeAttribute('face');
  });
  return doc.body.innerHTML;
}

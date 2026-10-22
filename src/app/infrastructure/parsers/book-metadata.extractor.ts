import { Injectable } from '@angular/core';
import { BookFormat, BookMetadata, SUPPORTED_EXTENSIONS } from '../../domain/entities';
import { BookMetadataExtractor } from '../../application/ports';
import { toThumbnail } from '../../core/image';
import { loadPdfJs } from './pdfjs';

/** Lê título, autor e capa dos arquivos EPUB, PDF e MOBI. As bibliotecas são carregadas sob demanda. */
@Injectable()
export class DefaultBookMetadataExtractor extends BookMetadataExtractor {
  async detectFormat(file: File): Promise<BookFormat | null> {
    const head = new Uint8Array(await file.slice(0, 68).arrayBuffer());
    const ascii = (from: number, len: number) => String.fromCharCode(...head.subarray(from, from + len));
    if (ascii(0, 4) === '%PDF') return 'pdf';
    if (ascii(60, 8) === 'BOOKMOBI' || ascii(60, 8) === 'TEXtREAd') return 'mobi';
    if (ascii(0, 2) === 'PK') return 'epub';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return SUPPORTED_EXTENSIONS[ext] ?? null;
  }

  extract(file: File, format: BookFormat): Promise<BookMetadata> {
    switch (format) {
      case 'epub':
        return this.epub(file);
      case 'pdf':
        return this.pdf(file);
      case 'mobi':
        return this.mobi(file);
    }
  }

  private async epub(file: File): Promise<BookMetadata> {
    const { default: ePub } = await import('epubjs');
    const book = ePub(await file.arrayBuffer());
    try {
      const metadata = await book.loaded.metadata;
      let coverDataUrl: string | null = null;
      const coverUrl = await book.coverUrl().catch(() => null);
      if (coverUrl) {
        const blob = await (await fetch(coverUrl)).blob();
        coverDataUrl = await toThumbnail(blob).catch(() => null);
      }
      return { title: metadata.title ?? '', author: metadata.creator ?? '', coverDataUrl };
    } finally {
      book.destroy();
    }
  }

  private async pdf(file: File): Promise<BookMetadata> {
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    try {
      const { info } = (await doc.getMetadata().catch(() => ({ info: {} }))) as { info: Record<string, unknown> };
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 400 / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      return {
        title: typeof info['Title'] === 'string' ? info['Title'] : '',
        author: typeof info['Author'] === 'string' ? info['Author'] : '',
        coverDataUrl: await toThumbnail(canvas),
      };
    } finally {
      await task.destroy();
    }
  }

  private async mobi(file: File): Promise<BookMetadata> {
    const { parseMobi } = await import('./mobi-parser');
    const mobi = await parseMobi(file, { withContent: false });
    const coverDataUrl = mobi.coverBlob ? await toThumbnail(mobi.coverBlob).catch(() => null) : null;
    return { title: mobi.title, author: mobi.author, coverDataUrl };
  }
}

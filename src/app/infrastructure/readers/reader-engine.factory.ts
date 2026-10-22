import { Injectable } from '@angular/core';
import { BookFormat } from '../../domain/entities';
import { ReaderEngine, ReaderEngineFactory } from '../../application/ports';

/** Cada motor (e sua biblioteca) é carregado sob demanda, só quando um livro daquele formato é aberto. */
@Injectable()
export class LazyReaderEngineFactory extends ReaderEngineFactory {
  async create(format: BookFormat): Promise<ReaderEngine> {
    switch (format) {
      case 'epub':
        return new (await import('./epub.engine')).EpubEngine();
      case 'pdf':
        return new (await import('./pdf.engine')).PdfEngine();
      case 'mobi':
        return new (await import('./mobi.engine')).MobiEngine();
    }
  }
}

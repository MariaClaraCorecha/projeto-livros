import type * as PdfJs from 'pdfjs-dist';

let pdfjs: Promise<typeof PdfJs> | undefined;

/** Carrega o pdf.js sob demanda (fica fora do bundle inicial) e configura o worker. */
export function loadPdfJs(): Promise<typeof PdfJs> {
  pdfjs ??= import('pdfjs-dist').then((lib) => {
    // O worker é copiado para /pdfjs pelo angular.json (assets).
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    return lib;
  });
  return pdfjs;
}

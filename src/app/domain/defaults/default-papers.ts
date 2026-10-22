import { Paper } from '../entities';

const noise =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45 0 0 0 0 .35 0 0 0 0 .2 0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export const DEFAULT_PAPERS: readonly Paper[] = [
  { id: 'white', name: 'Branco', background: '#ffffff', textColor: '#1f1f1f', dark: false, pdfFilter: 'none' },
  { id: 'cream', name: 'Creme', background: '#fbf6ea', textColor: '#2b2620', dark: false, pdfFilter: 'sepia(.12)' },
  { id: 'sepia', name: 'Sépia', background: '#f1e4c8', textColor: '#4a3b28', dark: false, pdfFilter: 'sepia(.45)' },
  { id: 'recycled', name: 'Reciclado', background: `${noise}, #ece6d9`, textColor: '#2e2a24', dark: false, pdfFilter: 'sepia(.25) contrast(.95)' },
  { id: 'parchment', name: 'Pergaminho', background: `${noise}, radial-gradient(circle at 50% 40%, #f8ecd0, #e3cfa3)`, textColor: '#3d2f1c', dark: false, pdfFilter: 'sepia(.6) contrast(.95)' },
  { id: 'mint', name: 'Menta', background: '#e6f2ea', textColor: '#1e2e24', dark: false, pdfFilter: 'hue-rotate(60deg) sepia(.1)' },
  { id: 'gray', name: 'Cinza', background: '#3a3b3e', textColor: '#d9d9d9', dark: true, pdfFilter: 'invert(.85) hue-rotate(180deg)' },
  { id: 'night', name: 'Noite', background: '#1b1d24', textColor: '#c9ccd6', dark: true, pdfFilter: 'invert(.9) hue-rotate(180deg)' },
  { id: 'amoled', name: 'Preto', background: '#000000', textColor: '#bdbdbd', dark: true, pdfFilter: 'invert(1) hue-rotate(180deg)' },
];

import { ReaderPreferences } from '../entities';

export function createDefaultPreferences(ownerId: string): ReaderPreferences {
  return {
    ownerId,
    themeMode: 'system',
    fontFamily: 'Literata',
    fontSize: 100,
    lineHeight: 1.6,
    margin: 32,
    textAlign: 'justify',
    paperId: 'cream',
    flow: 'paginated',
    pdfZoom: 1,
    iconStyle: 'outlined',
    extraFonts: [],
    extraIcons: [],
    customHighlighters: [],
    hiddenHighlighterIds: [],
    activeHighlighterId: 'hl-yellow',
    recentStickers: [],
  };
}

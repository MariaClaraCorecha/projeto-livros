import { StickerPack } from '../entities';

export const DEFAULT_STICKER_PACKS: readonly StickerPack[] = [
  { id: 'reactions', name: 'Reações', emojis: ['❤️', '😍', '😂', '😮', '😢', '😡', '👍', '👎', '🤔', '🥹', '😱', '🙌'] },
  { id: 'reading', name: 'Leitura', emojis: ['📚', '📖', '🔖', '✏️', '📝', '💡', '❓', '❗', '⭐', '📌', '🧠', '🎯'] },
  { id: 'nature', name: 'Natureza', emojis: ['🌸', '🌿', '🌙', '☀️', '🔥', '🌈', '🍂', '❄️', '🌊', '🌻', '🍀', '⚡'] },
  { id: 'fun', name: 'Diversão', emojis: ['🎉', '✨', '💎', '🦄', '🐱', '🐶', '👻', '🤖', '🍕', '☕', '🎵', '🏆'] },
];

/** Ícones Material Symbols que já vêm na coleção. */
export const DEFAULT_ICONS: readonly string[] = [
  'favorite', 'star', 'lightbulb', 'bookmark', 'help', 'priority_high', 'check_circle', 'push_pin',
  'psychology', 'format_quote', 'auto_awesome', 'local_fire_department', 'sentiment_satisfied',
  'sentiment_dissatisfied', 'flag', 'edit_note', 'school', 'translate',
];

/** Catálogo para busca de novos ícones (o usuário também pode digitar qualquer nome). */
export const ICON_CATALOG: readonly string[] = Array.from(
  new Set([
    ...DEFAULT_ICONS,
    'thumb_up', 'thumb_down', 'mood', 'mood_bad', 'sentiment_very_satisfied', 'sentiment_neutral', 'heart_broken',
    'bolt', 'rocket_launch', 'diamond', 'workspace_premium', 'military_tech', 'emoji_events', 'celebration',
    'pets', 'eco', 'park', 'forest', 'local_florist', 'spa', 'water_drop', 'sunny', 'dark_mode', 'bedtime',
    'cloud', 'thunderstorm', 'ac_unit', 'whatshot', 'cake', 'coffee', 'restaurant', 'music_note', 'headphones',
    'movie', 'palette', 'brush', 'draw', 'ink_pen', 'history_edu', 'menu_book', 'auto_stories', 'library_books',
    'book', 'bookmarks', 'label', 'sell', 'tag', 'search', 'visibility', 'info', 'warning', 'error', 'report',
    'question_mark', 'quiz', 'lightbulb_circle', 'tips_and_updates', 'science', 'biotech', 'calculate', 'functions',
    'public', 'language', 'map', 'explore', 'travel_explore', 'flight', 'home', 'castle', 'church', 'skull',
    'swords', 'shield', 'key', 'lock', 'vpn_key', 'person', 'group', 'face', 'child_care', 'elderly',
    'handshake', 'volunteer_activism', 'savings', 'paid', 'schedule', 'hourglass_empty', 'event', 'today',
    'timer', 'alarm', 'notifications', 'campaign', 'chat', 'forum', 'mail', 'call', 'link', 'attach_file',
    'content_cut', 'location_on', 'trending_up', 'trending_down', 'insights', 'target', 'crisis_alert',
    'gavel', 'balance', 'self_improvement', 'fitness_center', 'sports_esports', 'extension', 'magic_button',
    'auto_fix_high', 'stars', 'grade', 'new_releases', 'verified', 'task_alt', 'done_all', 'cancel', 'block',
  ]),
);

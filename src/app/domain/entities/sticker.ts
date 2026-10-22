export type StickerRef =
  | { readonly kind: 'emoji'; readonly value: string }
  | { readonly kind: 'icon'; readonly value: string }
  | { readonly kind: 'image'; readonly value: string /* id da figurinha personalizada */ };

export interface CustomSticker {
  readonly id: string;
  readonly ownerId: string;
  name: string;
  readonly dataUrl: string;
  readonly createdAt: number;
}

export interface StickerPack {
  readonly id: string;
  readonly name: string;
  readonly emojis: readonly string[];
}

export interface Shelf {
  readonly id: string;
  readonly ownerId: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  readonly createdAt: number;
}

export const UNSHELVED_ID = '__unshelved__';

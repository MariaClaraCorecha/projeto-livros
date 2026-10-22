import { inject, Injectable } from '@angular/core';
import { CustomSticker } from '../../domain/entities';
import { StickerRepository } from '../../domain/repositories';
import { CurrentUser, newId } from './current-user';

/** Arquivo `.json` usado para exportar/importar coleções de figurinhas. */
export interface StickerPackFile {
  readonly format: typeof STICKER_PACK_FORMAT;
  readonly version: 1;
  readonly name: string;
  readonly stickers: readonly StickerData[];
}

export interface StickerData {
  readonly name: string;
  readonly dataUrl: string;
}

export const STICKER_PACK_FORMAT = 'estante-figurinhas';

/** Lê um pacote exportado pelo app, ignorando itens inválidos. Lança erro se o arquivo não for um pacote. */
export function parseStickerPack(json: string): StickerData[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('O arquivo não é um pacote de figurinhas válido.');
  }
  const pack = data as Partial<StickerPackFile> | null;
  if (pack?.format !== STICKER_PACK_FORMAT || !Array.isArray(pack.stickers)) {
    throw new Error('O arquivo não é um pacote de figurinhas válido.');
  }
  return pack.stickers
    .filter((s): s is StickerData => typeof s?.dataUrl === 'string' && /^data:image\/[\w.+-]+(;[\w=-]+)*,/i.test(s.dataUrl))
    .map((s) => ({ name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 80) : 'Figurinha', dataUrl: s.dataUrl }));
}

@Injectable({ providedIn: 'root' })
export class ManageStickersUseCase {
  private readonly repo = inject(StickerRepository);
  private readonly user = inject(CurrentUser);

  async list(): Promise<CustomSticker[]> {
    const list = await this.repo.listByOwner(this.user.id());
    return list.sort((a, b) => a.createdAt - b.createdAt);
  }

  async create(name: string, dataUrl: string): Promise<CustomSticker> {
    const sticker: CustomSticker = { id: newId(), ownerId: this.user.id(), name, dataUrl, createdAt: Date.now() };
    await this.repo.save(sticker);
    return sticker;
  }

  /** Cria várias figurinhas de uma vez, ignorando as que o usuário já tem (mesma imagem). */
  async createMany(items: readonly StickerData[]): Promise<CustomSticker[]> {
    const existing = new Set((await this.repo.listByOwner(this.user.id())).map((s) => s.dataUrl));
    const created: CustomSticker[] = [];
    for (const { name, dataUrl } of items) {
      if (existing.has(dataUrl)) continue;
      existing.add(dataUrl);
      // `createdAt` crescente mantém a ordem do pacote.
      const sticker: CustomSticker = { id: newId(), ownerId: this.user.id(), name, dataUrl, createdAt: Date.now() + created.length };
      await this.repo.save(sticker);
      created.push(sticker);
    }
    return created;
  }

  async exportPack(name = 'Minhas figurinhas'): Promise<StickerPackFile> {
    const list = await this.list();
    return {
      format: STICKER_PACK_FORMAT,
      version: 1,
      name,
      stickers: list.map(({ name, dataUrl }) => ({ name, dataUrl })),
    };
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}

import { inject, Injectable } from '@angular/core';
import { CustomSticker } from '../../domain/entities';
import { StickerRepository } from '../../domain/repositories';
import { CurrentUser, newId } from './current-user';

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

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}

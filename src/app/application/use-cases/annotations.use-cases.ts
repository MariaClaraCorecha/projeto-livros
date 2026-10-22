import { inject, Injectable } from '@angular/core';
import { Annotation, AnnotationAudio, StickerRef } from '../../domain/entities';
import { AnnotationRepository } from '../../domain/repositories';
import { ReaderSelection } from '../ports';
import { CurrentUser, newId } from './current-user';

@Injectable({ providedIn: 'root' })
export class ListAnnotationsUseCase {
  private readonly annotations = inject(AnnotationRepository);

  async execute(bookId: string): Promise<Annotation[]> {
    const list = await this.annotations.listByBook(bookId);
    return list.sort((a, b) => a.sortKey - b.sortKey || a.createdAt - b.createdAt);
  }
}

export interface AnnotationDraft {
  highlighterId: string | null;
  comment?: string;
  sticker?: StickerRef | null;
  audio?: AnnotationAudio | null;
}

@Injectable({ providedIn: 'root' })
export class CreateAnnotationUseCase {
  private readonly annotations = inject(AnnotationRepository);
  private readonly user = inject(CurrentUser);

  async execute(bookId: string, selection: ReaderSelection, draft: AnnotationDraft): Promise<Annotation> {
    const now = Date.now();
    const annotation: Annotation = {
      id: newId(),
      ownerId: this.user.id(),
      bookId,
      anchor: selection.anchor,
      quote: selection.quote,
      locationLabel: selection.locationLabel,
      sortKey: selection.sortKey,
      highlighterId: draft.highlighterId,
      comment: draft.comment?.trim() ?? '',
      sticker: draft.sticker ?? null,
      audio: draft.audio ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.annotations.save(annotation);
    return annotation;
  }
}

@Injectable({ providedIn: 'root' })
export class UpdateAnnotationUseCase {
  private readonly annotations = inject(AnnotationRepository);

  async execute(annotation: Annotation, changes: Partial<AnnotationDraft>): Promise<Annotation> {
    const updated: Annotation = {
      ...annotation,
      ...changes,
      comment: (changes.comment ?? annotation.comment).trim(),
      updatedAt: Date.now(),
    };
    await this.annotations.save(updated);
    return updated;
  }
}

@Injectable({ providedIn: 'root' })
export class DeleteAnnotationUseCase {
  private readonly annotations = inject(AnnotationRepository);
  execute(id: string): Promise<void> {
    return this.annotations.delete(id);
  }
}

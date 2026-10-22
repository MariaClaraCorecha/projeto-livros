import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { StickerRef } from '../../domain/entities';
import { PreferencesStore } from '../state/preferences.store';

/** Mostra uma figurinha (emoji, ícone Material Symbols ou imagem) na interface. */
@Component({
  selector: 'app-sticker',
  imports: [MatIconModule],
  template: `
    @switch (sticker().kind) {
      @case ('emoji') {
        <span class="emoji">{{ sticker().value }}</span>
      }
      @case ('icon') {
        <mat-icon [fontSet]="iconSet()">{{ sticker().value }}</mat-icon>
      }
      @case ('image') {
        @if (imageUrl(); as url) {
          <img [src]="url" alt="" />
        } @else {
          <mat-icon>broken_image</mat-icon>
        }
      }
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; justify-content: center; width: var(--sticker-size, 28px);
      height: var(--sticker-size, 28px); line-height: 1; }
    .emoji { font-size: calc(var(--sticker-size, 28px) * .82); }
    mat-icon { font-size: calc(var(--sticker-size, 28px) * .86); width: auto; height: auto; color: var(--mat-sys-tertiary); }
    img { width: 100%; height: 100%; object-fit: contain; }
  `,
})
export class StickerViewComponent {
  private readonly prefs = inject(PreferencesStore);
  readonly sticker = input.required<StickerRef>();

  protected readonly iconSet = computed(() => `material-symbols-${this.prefs.prefs()?.iconStyle ?? 'outlined'}`);
  protected readonly imageUrl = computed(() => {
    const s = this.sticker();
    return s.kind === 'image' ? (this.prefs.customStickers().find((c) => c.id === s.value)?.dataUrl ?? null) : null;
  });
}

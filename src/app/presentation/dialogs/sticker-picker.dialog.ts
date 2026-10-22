import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DEFAULT_STICKER_PACKS } from '../../domain/defaults';
import { StickerRef } from '../../domain/entities';
import { PreferencesStore } from '../state/preferences.store';
import { StickerViewComponent } from '../shared/sticker-view.component';

export type StickerPickerResult = StickerRef | 'remove';

@Component({
  selector: 'app-sticker-picker-dialog',
  imports: [MatDialogModule, MatButtonModule, MatTabsModule, MatIconModule, MatTooltipModule, RouterLink, StickerViewComponent],
  template: `
    <h2 mat-dialog-title>Escolha uma figurinha</h2>
    <mat-dialog-content class="content">
      <mat-tab-group mat-stretch-tabs="false" animationDuration="150ms">
        @if (recent().length) {
          <mat-tab label="Recentes">
            <div class="grid">
              @for (s of recent(); track $index) {
                <button class="cell" (click)="pick(s)"><app-sticker [sticker]="s" /></button>
              }
            </div>
          </mat-tab>
        }
        <mat-tab label="Emojis">
          @for (pack of packs; track pack.id) {
            <h3 class="pack">{{ pack.name }}</h3>
            <div class="grid">
              @for (e of pack.emojis; track e) {
                <button class="cell" (click)="pick({ kind: 'emoji', value: e })"><span class="emoji">{{ e }}</span></button>
              }
            </div>
          }
        </mat-tab>
        <mat-tab label="Ícones">
          <div class="grid">
            @for (i of prefs.icons(); track i) {
              <button class="cell" (click)="pick({ kind: 'icon', value: i })" [matTooltip]="i">
                <app-sticker [sticker]="{ kind: 'icon', value: i }" />
              </button>
            }
          </div>
        </mat-tab>
        <mat-tab label="Minhas figurinhas">
          @if (prefs.customStickers().length) {
            <div class="grid">
              @for (s of prefs.customStickers(); track s.id) {
                <button class="cell" (click)="pick({ kind: 'image', value: s.id })" [matTooltip]="s.name">
                  <app-sticker [sticker]="{ kind: 'image', value: s.id }" />
                </button>
              }
            </div>
          } @else {
            <p class="muted empty">Você ainda não criou figurinhas. Envie imagens em <b>Personalizar › Figurinhas</b>.</p>
          }
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions>
      <a mat-button routerLink="/personalizar" [queryParams]="{ aba: 'figurinhas' }" mat-dialog-close>
        <mat-icon>add_photo_alternate</mat-icon> Mais figurinhas
      </a>
      <span class="spacer"></span>
      @if (data.allowRemove) {
        <button mat-button (click)="ref.close('remove')">Remover figurinha</button>
      }
      <button mat-button mat-dialog-close>Fechar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { min-height: 300px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 4px; padding: 12px 0; }
    .cell { border: none; background: none; border-radius: 12px; height: 48px; cursor: pointer; display: grid; place-items: center;
      --sticker-size: 30px; }
    .cell:hover, .cell:focus-visible { background: var(--mat-sys-surface-container-highest); }
    .emoji { font-size: 26px; line-height: 1; }
    .pack { font: var(--mat-sys-title-small); margin: 12px 0 0; }
    .empty { padding: 24px 0; }
  `,
})
export class StickerPickerDialog {
  protected readonly data = inject<{ allowRemove: boolean }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<StickerPickerDialog, StickerPickerResult>>(MatDialogRef);
  protected readonly prefs = inject(PreferencesStore);
  protected readonly packs = DEFAULT_STICKER_PACKS;

  protected readonly recent = computed<StickerRef[]>(() =>
    (this.prefs.prefs()?.recentStickers ?? [])
      .map((key) => {
        const i = key.indexOf(':');
        return { kind: key.slice(0, i), value: key.slice(i + 1) } as StickerRef;
      })
      .filter((s) => s.kind !== 'image' || this.prefs.customStickers().some((c) => c.id === s.value)),
  );

  protected pick(sticker: StickerRef): void {
    void this.prefs.rememberSticker(sticker);
    this.ref.close(sticker);
  }
}

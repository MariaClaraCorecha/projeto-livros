import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DEFAULT_STICKER_PACKS } from '../../../domain/defaults';
import { toThumbnail } from '../../../core/image';
import { PreferencesStore } from '../../state/preferences.store';

@Component({
  selector: 'app-stickers-tab',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <section>
      <h2>Minhas figurinhas</h2>
      <p class="muted">Envie imagens (PNG com fundo transparente fica ótimo) para colar nos trechos que você marcar.</p>
      <input #picker type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" multiple hidden (change)="upload($event)" />
      <div class="sticker-grid">
        <button class="sticker-cell add" (click)="picker.click()" [disabled]="busy()">
          <mat-icon>add_photo_alternate</mat-icon>
          <span>Enviar</span>
        </button>
        @for (s of prefs.customStickers(); track s.id) {
          <div class="sticker-cell" [matTooltip]="s.name">
            <img [src]="s.dataUrl" [alt]="s.name" />
            <button class="remove" (click)="prefs.removeSticker(s.id)" [attr.aria-label]="'Excluir ' + s.name"><mat-icon>close</mat-icon></button>
          </div>
        }
      </div>
    </section>

    <section>
      <h2>Pacotes de emojis</h2>
      <p class="muted">Já vêm no sistema. Ícones da sua coleção também podem ser usados como figurinhas.</p>
      @for (pack of packs; track pack.id) {
        <h3>{{ pack.name }}</h3>
        <div class="emoji-row">
          @for (e of pack.emojis; track e) {
            <span class="emoji">{{ e }}</span>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './customize-tabs.scss',
})
export class StickersTabComponent {
  protected readonly prefs = inject(PreferencesStore);
  private readonly snack = inject(MatSnackBar);
  protected readonly packs = DEFAULT_STICKER_PACKS;
  protected readonly busy = signal(false);

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.busy.set(true);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          this.snack.open(`"${file.name}" é muito grande (máx. 5 MB).`, 'OK');
          continue;
        }
        // PNG preserva a transparência; 192px é suficiente para uma figurinha.
        const dataUrl = await toThumbnail(file, 192, 'image/png');
        await this.prefs.addSticker(file.name.replace(/\.[^.]+$/, ''), dataUrl);
      }
    } catch {
      this.snack.open('Não foi possível ler uma das imagens.', 'OK');
    } finally {
      this.busy.set(false);
    }
  }
}

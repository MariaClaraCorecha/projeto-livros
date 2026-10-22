import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DEFAULT_STICKER_PACKS } from '../../../domain/defaults';
import { STICKER_IMPORT_ACCEPT, StickerImporter } from '../../shared/sticker-importer';
import { PreferencesStore } from '../../state/preferences.store';

@Component({
  selector: 'app-stickers-tab',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  host: { '(window:paste)': 'onPaste($event)' },
  template: `
    <section class="drop-zone" [class.dragging]="dragging()" (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)"
             (drop)="onDrop($event)">
      <h2>Minhas figurinhas</h2>
      <p class="muted">
        Envie imagens (PNG com fundo transparente fica ótimo) para colar nos trechos que você marcar. Também dá para arrastar
        arquivos para cá, colar uma imagem com <kbd>Ctrl</kbd>+<kbd>V</kbd> ou importar um pacote <code>.json</code> exportado
        por outra pessoa.
      </p>
      <input #picker type="file" [accept]="accept" multiple hidden (change)="upload($event)" />
      <div class="sticker-actions">
        <button mat-stroked-button (click)="picker.click()" [disabled]="importer.busy()">
          <mat-icon>upload_file</mat-icon> Importar
        </button>
        <button mat-button (click)="importer.exportPack()" [disabled]="!prefs.customStickers().length">
          <mat-icon>download</mat-icon> Exportar pacote
        </button>
        @if (importer.busy()) {
          <mat-spinner diameter="20" />
        }
      </div>
      <div class="sticker-grid">
        <button class="sticker-cell add" (click)="picker.click()" [disabled]="importer.busy()">
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
  protected readonly importer = inject(StickerImporter);
  protected readonly packs = DEFAULT_STICKER_PACKS;
  protected readonly accept = STICKER_IMPORT_ACCEPT;
  protected readonly dragging = signal(false);

  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.importer.importFiles(files);
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    void this.importer.importFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onPaste(event: ClipboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable]')) return;
    void this.importer.importClipboard(event);
  }
}

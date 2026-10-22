import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { parseStickerPack, StickerData } from '../../application/use-cases';
import { toThumbnail } from '../../core/image';
import { PreferencesStore } from '../state/preferences.store';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PACK_SIZE = 50 * 1024 * 1024;

/** Tipos aceitos pelo seletor de arquivos: imagens soltas ou pacotes `.json` exportados pelo app. */
export const STICKER_IMPORT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.json,application/json';

/**
 * Importa figurinhas de imagens (arquivo, arrastar e soltar ou colar) e de pacotes `.json`,
 * e exporta as figurinhas do usuário como pacote. Usado em Personalizar e no seletor de figurinhas.
 */
@Injectable({ providedIn: 'root' })
export class StickerImporter {
  private readonly prefs = inject(PreferencesStore);
  private readonly snack = inject(MatSnackBar);

  readonly busy = signal(false);

  async importFiles(files: readonly File[]): Promise<number> {
    if (!files.length || this.busy()) return 0;
    this.busy.set(true);
    const items: StickerData[] = [];
    const failed: string[] = [];
    try {
      for (const file of files) {
        try {
          items.push(...(isPack(file) ? await this.readPack(file) : [await this.readImage(file)]));
        } catch (e) {
          failed.push(e instanceof Error && e.message ? e.message : `Não foi possível ler "${file.name}".`);
        }
      }
      const added = items.length ? await this.prefs.addStickers(items) : 0;
      this.report(added, items.length - added, failed);
      return added;
    } finally {
      this.busy.set(false);
    }
  }

  /** Imagens coladas com Ctrl+V (por exemplo, copiadas de um site). */
  async importClipboard(event: ClipboardEvent): Promise<number> {
    const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return 0;
    event.preventDefault();
    return this.importFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : renamed(f, `Colada ${i + 1}`))));
  }

  /** Baixa todas as figurinhas do usuário em um único arquivo `.json`. */
  async exportPack(): Promise<void> {
    const pack = await this.prefs.exportStickers();
    if (!pack.stickers.length) {
      this.snack.open('Você ainda não tem figurinhas para exportar.', 'OK');
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'figurinhas.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------------------------------------------------------------- */

  private async readImage(file: File): Promise<StickerData> {
    if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`);
    if (file.size > MAX_IMAGE_SIZE) throw new Error(`"${file.name}" é muito grande (máx. 5 MB).`);
    // PNG preserva a transparência; 192px é suficiente para uma figurinha.
    return { name: file.name.replace(/\.[^.]+$/, '') || 'Figurinha', dataUrl: await toThumbnail(file, 192, 'image/png') };
  }

  private async readPack(file: File): Promise<StickerData[]> {
    if (file.size > MAX_PACK_SIZE) throw new Error(`"${file.name}" é muito grande (máx. 50 MB).`);
    const stickers = parseStickerPack(await file.text());
    // Cada imagem é redesenhada: valida o conteúdo e mantém o tamanho padrão das figurinhas.
    const result: StickerData[] = [];
    for (const s of stickers) {
      try {
        const blob = await (await fetch(s.dataUrl)).blob();
        result.push({ name: s.name, dataUrl: await toThumbnail(blob, 192, 'image/png') });
      } catch {
        /* imagem corrompida no pacote: ignorada */
      }
    }
    if (!result.length) throw new Error(`"${file.name}" não tem figurinhas válidas.`);
    return result;
  }

  private report(added: number, duplicated: number, failed: string[]): void {
    const parts: string[] = [];
    if (added) parts.push(added === 1 ? '1 figurinha importada' : `${added} figurinhas importadas`);
    if (duplicated) parts.push(duplicated === 1 ? '1 já existia' : `${duplicated} já existiam`);
    if (failed.length) parts.push(failed.length === 1 ? failed[0] : `${failed.length} arquivos não puderam ser lidos`);
    if (parts.length) this.snack.open(`${parts.join(' · ')}.`, 'OK', { duration: failed.length ? 6000 : 3000 });
  }
}

function isPack(file: File): boolean {
  return file.type === 'application/json' || /\.json$/i.test(file.name);
}

function renamed(file: File, name: string): File {
  return new File([file], name, { type: file.type });
}

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Annotation } from '../../../domain/entities';
import { highlighterStyle } from '../../../core/highlighter-style';
import { StickerViewComponent } from '../../shared/sticker-view.component';
import { AudioPlayerComponent, formatDuration } from '../../shared/audio-player.component';
import { PreferencesStore } from '../../state/preferences.store';

type Filter = 'all' | 'highlights' | 'comments' | 'audio' | 'stickers';

@Component({
  selector: 'app-annotations-panel',
  imports: [DatePipe, MatButtonModule, MatButtonToggleModule, MatIconModule, MatMenuModule, StickerViewComponent, AudioPlayerComponent],
  template: `
    <div class="tools">
      <mat-button-toggle-group [value]="filter()" (change)="filter.set($event.value)" hideSingleSelectionIndicator>
        <mat-button-toggle value="all">Todas</mat-button-toggle>
        <mat-button-toggle value="highlights"><mat-icon>ink_highlighter</mat-icon></mat-button-toggle>
        <mat-button-toggle value="comments"><mat-icon>comment</mat-icon></mat-button-toggle>
        <mat-button-toggle value="audio" aria-label="Notas de voz"><mat-icon>mic</mat-icon></mat-button-toggle>
        <mat-button-toggle value="stickers"><mat-icon>add_reaction</mat-icon></mat-button-toggle>
      </mat-button-toggle-group>
      <button mat-icon-button [matMenuTriggerFor]="more" aria-label="Mais opções"><mat-icon>more_vert</mat-icon></button>
      <mat-menu #more="matMenu">
        <button mat-menu-item (click)="exportMarkdown()" [disabled]="!annotations().length">
          <mat-icon>download</mat-icon><span>Exportar anotações (.md)</span>
        </button>
      </mat-menu>
    </div>

    <input class="search" type="search" placeholder="Buscar nas anotações" [value]="query()" (input)="query.set($any($event.target).value)" />

    @for (a of visible(); track a.id) {
      <article class="item" (click)="open.emit(a)" tabindex="0" (keydown.enter)="open.emit(a)">
        <div class="meta">
          <span>{{ a.locationLabel || 'Trecho' }}</span>
          <span class="spacer"></span>
          <span>{{ a.createdAt | date: 'dd/MM/yy' }}</span>
        </div>
        <p class="quote"><span [style]="style(a)">{{ a.quote }}</span></p>
        @if (a.comment) {
          <p class="comment"><mat-icon>comment</mat-icon>{{ a.comment }}</p>
        }
        @if (a.audio) {
          <app-audio-player [audio]="a.audio" class="audio" />
        }
        <div class="actions">
          @if (a.sticker) {
            <app-sticker [sticker]="a.sticker" />
          }
          <span class="spacer"></span>
          <button mat-icon-button (click)="$event.stopPropagation(); edit.emit(a)" aria-label="Editar"><mat-icon>edit</mat-icon></button>
          <button mat-icon-button (click)="$event.stopPropagation(); remove.emit(a)" aria-label="Excluir"><mat-icon>delete</mat-icon></button>
        </div>
      </article>
    } @empty {
      <div class="empty muted">
        <mat-icon>ink_highlighter</mat-icon>
        <p>Selecione um trecho do livro para marcar, comentar, gravar uma nota de voz ou colar uma figurinha.</p>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; padding: 8px 12px 24px; }
    .tools { display: flex; align-items: center; justify-content: space-between; }
    .search { height: 38px; border-radius: 19px; border: 1px solid var(--mat-sys-outline-variant); padding: 0 14px;
      background: var(--mat-sys-surface-container-low); color: inherit; font: var(--mat-sys-body-medium); }
    .item { padding: 10px 12px 4px; border-radius: 12px; background: var(--mat-sys-surface-container-low); cursor: pointer; }
    .item:hover, .item:focus-visible { background: var(--mat-sys-surface-container-high); }
    .meta { display: flex; font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }
    .quote { margin: 6px 0; font-family: var(--display-font); font-weight: 400; line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .comment { display: flex; gap: 6px; margin: 0 0 4px; font: var(--mat-sys-body-small); white-space: pre-wrap; }
    .comment mat-icon { font-size: 16px; width: 16px; height: 16px; flex: none; color: var(--mat-sys-primary); }
    .audio { margin: 4px 0; }
    .actions { display: flex; align-items: center; }
    .empty { text-align: center; padding: 32px 8px; }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; }
  `,
})
export class AnnotationsPanelComponent {
  private readonly prefs = inject(PreferencesStore);
  readonly annotations = input.required<Annotation[]>();
  readonly bookTitle = input('');
  readonly open = output<Annotation>();
  readonly edit = output<Annotation>();
  readonly remove = output<Annotation>();

  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');

  protected readonly visible = computed(() => {
    const q = this.query().toLowerCase().trim();
    return this.annotations().filter((a) => {
      const byType =
        this.filter() === 'all' ||
        (this.filter() === 'highlights' && a.highlighterId) ||
        (this.filter() === 'comments' && a.comment) ||
        (this.filter() === 'audio' && a.audio) ||
        (this.filter() === 'stickers' && a.sticker);
      return byType && (!q || `${a.quote} ${a.comment}`.toLowerCase().includes(q));
    });
  });

  protected style(a: Annotation): string {
    return highlighterStyle(this.prefs.allHighlighters().find((x) => x.id === a.highlighterId) ?? null);
  }

  protected exportMarkdown(): void {
    const lines = [`# ${this.bookTitle()}`, ''];
    for (const a of this.annotations()) {
      lines.push(`> ${a.quote.replace(/\n+/g, ' ')}`, '');
      if (a.locationLabel) lines.push(`*${a.locationLabel}*`, '');
      if (a.comment) lines.push(a.comment, '');
      if (a.audio) lines.push(`🎙️ Nota de voz (${formatDuration(a.audio.durationMs)})`, '');
      lines.push('---', '');
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.bookTitle() || 'anotacoes'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

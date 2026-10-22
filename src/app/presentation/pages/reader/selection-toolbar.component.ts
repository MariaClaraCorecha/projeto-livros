import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Highlighter } from '../../../domain/entities';
import { HighlighterSwatchComponent } from '../../shared/highlighter-swatch.component';
import { PreferencesStore } from '../../state/preferences.store';

/** Barra flutuante exibida quando há texto selecionado. */
@Component({
  selector: 'app-selection-toolbar',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, HighlighterSwatchComponent],
  // Sem isso o `mousedown` desfaz a seleção do texto, a barra some e o clique no marca-texto se perde.
  host: { '(mousedown)': '$event.preventDefault()' },
  template: `
    <div class="quote" [title]="quote()">“{{ quote() }}”</div>
    <div class="row">
      <div class="swatches">
        @for (h of prefs.highlighters(); track h.id) {
          <app-highlighter-swatch [highlighter]="h" [selected]="h.id === prefs.activeHighlighter()?.id"
                                  (click)="highlight.emit(h)" (keydown.enter)="highlight.emit(h)" />
        }
        <a mat-icon-button routerLink="/personalizar" [queryParams]="{ aba: 'marca-textos' }" matTooltip="Criar marca-texto"
           aria-label="Criar marca-texto">
          <mat-icon>add</mat-icon>
        </a>
      </div>
      <span class="divider"></span>
      <button mat-icon-button (click)="comment.emit()" matTooltip="Comentar" aria-label="Comentar"><mat-icon>add_comment</mat-icon></button>
      <button mat-icon-button (click)="sticker.emit()" matTooltip="Figurinha" aria-label="Figurinha"><mat-icon>add_reaction</mat-icon></button>
      <button mat-icon-button (click)="copy.emit()" matTooltip="Copiar" aria-label="Copiar"><mat-icon>content_copy</mat-icon></button>
      <button mat-icon-button (click)="dismiss.emit()" matTooltip="Fechar" aria-label="Fechar"><mat-icon>close</mat-icon></button>
    </div>
  `,
  styles: `
    :host { position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%); z-index: 30; display: flex; flex-direction: column;
      gap: 6px; padding: 10px 12px; border-radius: 20px; max-width: calc(100vw - 24px); box-sizing: border-box;
      background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface); box-shadow: var(--mat-sys-level3);
      animation: rise .16s ease-out; }
    @keyframes rise { from { opacity: 0; transform: translate(-50%, 12px); } }
    .quote { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 560px; padding: 0 4px; }
    .row { display: flex; align-items: center; gap: 4px; }
    .swatches { display: flex; gap: 6px; overflow-x: auto; padding: 4px; scrollbar-width: thin; }
    .divider { width: 1px; align-self: stretch; background: var(--mat-sys-outline-variant); margin: 0 4px; }
  `,
})
export class SelectionToolbarComponent {
  protected readonly prefs = inject(PreferencesStore);
  readonly quote = input.required<string>();
  readonly highlight = output<Highlighter>();
  readonly comment = output<void>();
  readonly sticker = output<void>();
  readonly copy = output<void>();
  readonly dismiss = output<void>();
}

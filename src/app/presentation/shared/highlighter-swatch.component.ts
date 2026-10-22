import { Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Highlighter } from '../../domain/entities';
import { highlighterStyle } from '../../core/highlighter-style';

/** Amostra clicável de um marca-texto ("Aa" com o estilo aplicado). */
@Component({
  selector: 'app-highlighter-swatch',
  imports: [MatTooltipModule],
  host: { role: 'button', tabindex: '0', '[class.selected]': 'selected()', '[attr.aria-label]': 'highlighter().name' },
  template: `<span class="sample" [style]="sampleStyle()" [matTooltip]="highlighter().name">Aa</span>`,
  styles: `
    :host { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
      background: var(--mat-sys-surface-container-high); outline: 2px solid transparent; outline-offset: 2px; flex: none; }
    :host(.selected) { outline-color: var(--mat-sys-primary); }
    :host(:focus-visible) { outline-color: var(--mat-sys-tertiary); }
    .sample { font: 600 14px/1 var(--display-font); padding: 2px 3px; border-radius: 3px; color: var(--mat-sys-on-surface); }
  `,
})
export class HighlighterSwatchComponent {
  readonly highlighter = input.required<Highlighter>();
  readonly selected = input(false);

  protected readonly sampleStyle = computed(() => highlighterStyle(this.highlighter()));
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Highlighter, HIGHLIGHTER_STYLE_LABELS, HighlighterStyle } from '../../../domain/entities';
import { highlighterStyle } from '../../../core/highlighter-style';
import { PreferencesStore } from '../../state/preferences.store';

@Component({
  selector: 'app-highlighters-tab',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSliderModule, MatTooltipModule],
  template: `
    <section>
      <h2>{{ editing() ? 'Editar marca-texto' : 'Criar marca-texto' }}</h2>
      <div class="editor">
        <div class="fields">
          <mat-form-field appearance="outline">
            <mat-label>Nome</mat-label>
            <input matInput [ngModel]="draft().name" (ngModelChange)="patch({ name: $event })" maxlength="30" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Estilo</mat-label>
            <mat-select [ngModel]="draft().style" (ngModelChange)="patch({ style: $event })">
              @for (s of styles; track s.id) {
                <mat-option [value]="s.id">{{ s.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <div class="color-row">
            <label>Cor</label>
            @for (c of palette; track c) {
              <button class="swatch" [style.background]="c" [class.selected]="draft().color === c" (click)="patch({ color: c })"
                      [attr.aria-label]="c"></button>
            }
            <input type="color" [value]="draft().color" (input)="patch({ color: $any($event.target).value })" aria-label="Outra cor" />
          </div>
          @if (draft().style === 'highlight' || draft().style === 'gradient') {
            <label class="slider-label">Intensidade {{ (draft().opacity * 100).toFixed(0) }}%</label>
            <mat-slider min="0.15" max="1" step="0.05">
              <input matSliderThumb [value]="draft().opacity" (valueChange)="patch({ opacity: $event })" />
            </mat-slider>
          }
        </div>
        <div class="preview">
          <p>Era uma vez <span [style]="previewStyle()">um trecho marcado com o seu novo marca-texto</span>, no meio de um parágrafo qualquer.</p>
        </div>
      </div>
      <div class="actions">
        @if (editing()) {
          <button mat-button (click)="reset()">Cancelar</button>
        }
        <button mat-flat-button (click)="save()" [disabled]="!draft().name.trim()">
          <mat-icon>{{ editing() ? 'save' : 'add' }}</mat-icon> {{ editing() ? 'Salvar' : 'Criar marca-texto' }}
        </button>
      </div>
    </section>

    <section>
      <h2>
        Seus marca-textos
        @if (prefs.prefs()?.hiddenHighlighterIds?.length) {
          <button mat-button (click)="prefs.restoreHighlighters()">Restaurar padrão ocultos</button>
        }
      </h2>
      <div class="hl-list">
        @for (h of prefs.allHighlighters(); track h.id) {
          <article class="hl-item" [class.hidden]="isHidden(h)">
            <span class="hl-sample" [style]="style(h)">{{ h.name }}</span>
            <span class="muted small">{{ labels[h.style] }} · {{ h.builtIn ? 'Padrão' : 'Personalizado' }}</span>
            <span class="spacer"></span>
            @if (h.builtIn) {
              @if (isHidden(h)) {
                <span class="muted small">Oculto</span>
              } @else {
                <button mat-icon-button (click)="prefs.removeHighlighter(h)" matTooltip="Ocultar" aria-label="Ocultar"><mat-icon>visibility_off</mat-icon></button>
              }
            } @else {
              <button mat-icon-button (click)="edit(h)" matTooltip="Editar" aria-label="Editar"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button (click)="prefs.removeHighlighter(h)" matTooltip="Excluir" aria-label="Excluir"><mat-icon>delete</mat-icon></button>
            }
          </article>
        }
      </div>
    </section>
  `,
  styleUrl: './customize-tabs.scss',
})
export class HighlightersTabComponent {
  protected readonly prefs = inject(PreferencesStore);
  protected readonly labels = HIGHLIGHTER_STYLE_LABELS;
  protected readonly styles = (Object.keys(HIGHLIGHTER_STYLE_LABELS) as HighlighterStyle[]).map((id) => ({ id, label: HIGHLIGHTER_STYLE_LABELS[id] }));
  protected readonly palette = ['#ffd43b', '#69db7c', '#4dabf7', '#f783ac', '#ffa94d', '#9775fa', '#fa5252', '#20c997', '#868e96', '#212529'];

  private readonly empty = (): Highlighter => ({ id: '', name: '', color: '#20c997', style: 'highlight', opacity: 0.45, builtIn: false });
  protected readonly draft = signal<Highlighter>(this.empty());
  protected readonly editing = computed(() => this.draft().id !== '');
  protected readonly previewStyle = computed(() => highlighterStyle(this.draft()));

  protected style(h: Highlighter): string {
    return highlighterStyle(h);
  }

  protected isHidden(h: Highlighter): boolean {
    return this.prefs.prefs()?.hiddenHighlighterIds.includes(h.id) ?? false;
  }

  protected patch(changes: Partial<Highlighter>): void {
    this.draft.update((d) => ({ ...d, ...changes }));
  }

  protected edit(h: Highlighter): void {
    this.draft.set({ ...h });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected reset(): void {
    this.draft.set(this.empty());
  }

  protected async save(): Promise<void> {
    const { id, builtIn, ...data } = this.draft();
    const name = data.name.trim();
    if (id) await this.prefs.updateHighlighter({ ...data, id, builtIn, name });
    else await this.prefs.createHighlighter({ ...data, name });
    this.reset();
  }
}

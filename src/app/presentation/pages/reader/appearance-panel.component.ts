import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ORIGINAL_FONT } from '../../../domain/defaults';
import { fontStack, ReaderPreferences } from '../../../domain/entities';
import { PreferencesStore } from '../../state/preferences.store';

/** Painel "Aa": fonte, tamanho, espaçamento, papel, modo de leitura e tema. */
@Component({
  selector: 'app-appearance-panel',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatIconModule, MatSliderModule, MatTooltipModule],
  template: `
    @if (prefs.prefs(); as p) {
      <section>
        <h3>Papel</h3>
        <div class="papers">
          @for (paper of prefs.papers; track paper.id) {
            <button class="paper" [style.background]="paper.background" [style.color]="paper.textColor"
                    [class.selected]="p.paperId === paper.id" (click)="set({ paperId: paper.id })" [matTooltip]="paper.name">
              Aa
            </button>
          }
        </div>
      </section>

      <section>
        <h3>Modo de leitura</h3>
        <mat-button-toggle-group [value]="p.flow" (change)="set({ flow: $event.value })" class="full">
          <mat-button-toggle value="paginated"><mat-icon>auto_stories</mat-icon> Páginas</mat-button-toggle>
          <mat-button-toggle value="scrolled"><mat-icon>swipe_vertical</mat-icon> Rolagem</mat-button-toggle>
        </mat-button-toggle-group>
        <mat-button-toggle-group [value]="p.themeMode" (change)="set({ themeMode: $event.value })" class="full">
          <mat-button-toggle value="light"><mat-icon>light_mode</mat-icon></mat-button-toggle>
          <mat-button-toggle value="dark"><mat-icon>dark_mode</mat-icon></mat-button-toggle>
          <mat-button-toggle value="system"><mat-icon>contrast</mat-icon></mat-button-toggle>
        </mat-button-toggle-group>
      </section>

      @if (reflowable()) {
        <section>
          <h3>
            Fonte
            <a mat-button routerLink="/personalizar" [queryParams]="{ aba: 'fontes' }" class="more">
              <mat-icon>add</mat-icon> Mais fontes
            </a>
          </h3>
          <div class="fonts">
            <button class="font" [class.selected]="p.fontFamily === original" (click)="set({ fontFamily: original })">
              <span class="sample">Aa</span><span class="name">Original do livro</span>
            </button>
            @for (f of prefs.fonts(); track f.family) {
              <button class="font" [class.selected]="p.fontFamily === f.family" (click)="set({ fontFamily: f.family })"
                      [style.font-family]="stack(f)" (mouseenter)="prefs.loadFont(f)">
                <span class="sample">Aa</span><span class="name">{{ f.family }}</span>
              </button>
            }
          </div>
        </section>

        <section>
          <h3>Tamanho <span class="value">{{ p.fontSize }}%</span></h3>
          <div class="slider-row">
            <mat-icon class="small">text_decrease</mat-icon>
            <mat-slider min="70" max="200" step="5" discrete class="grow">
              <input matSliderThumb [value]="p.fontSize" (valueChange)="set({ fontSize: $event })" />
            </mat-slider>
            <mat-icon>text_increase</mat-icon>
          </div>

          <h3>Entrelinha <span class="value">{{ p.lineHeight }}</span></h3>
          <mat-slider min="1" max="2.4" step="0.1" discrete class="full">
            <input matSliderThumb [value]="p.lineHeight" (valueChange)="set({ lineHeight: $event })" />
          </mat-slider>

          <h3>Alinhamento</h3>
          <mat-button-toggle-group [value]="p.textAlign" (change)="set({ textAlign: $event.value })" class="full">
            <mat-button-toggle value="start"><mat-icon>format_align_left</mat-icon> Esquerda</mat-button-toggle>
            <mat-button-toggle value="justify"><mat-icon>format_align_justify</mat-icon> Justificado</mat-button-toggle>
          </mat-button-toggle-group>
        </section>
      } @else {
        <section>
          <h3>Zoom <span class="value">{{ (p.pdfZoom * 100).toFixed(0) }}%</span></h3>
          <mat-slider min="0.5" max="3" step="0.1" discrete class="full" [displayWith]="percent">
            <input matSliderThumb [value]="p.pdfZoom" (valueChange)="set({ pdfZoom: $event })" />
          </mat-slider>
          <p class="muted note">Em PDFs o layout é fixo: fontes e espaçamento não podem ser alterados, mas o papel é aplicado como filtro.</p>
        </section>
      }

      <section>
        <h3>Margens <span class="value">{{ p.margin }}px</span></h3>
        <mat-slider min="0" max="160" step="8" discrete class="full">
          <input matSliderThumb [value]="p.margin" (valueChange)="set({ margin: $event })" />
        </mat-slider>
      </section>
    }
  `,
  styles: `
    :host { display: block; padding: 4px 16px 24px; }
    section { padding: 8px 0 12px; border-bottom: 1px solid var(--mat-sys-outline-variant); display: flex; flex-direction: column; gap: 8px; }
    section:last-child { border-bottom: none; }
    h3 { font: var(--mat-sys-title-small); margin: 8px 0 0; display: flex; align-items: center; gap: 8px; }
    .value { margin-left: auto; font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); }
    .more { margin-left: auto; }
    .papers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .paper { aspect-ratio: 1; border-radius: 12px; border: 1px solid var(--mat-sys-outline-variant); cursor: pointer;
      font: 600 15px var(--display-font); outline: 2px solid transparent; outline-offset: 2px; background-size: cover; }
    .paper.selected { outline-color: var(--mat-sys-primary); }
    .fonts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 300px; overflow: auto; padding: 2px; }
    .font { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; cursor: pointer; text-align: left;
      border: 1px solid var(--mat-sys-outline-variant); background: var(--mat-sys-surface-container-low); color: inherit; min-width: 0; }
    .font.selected { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .sample { font-size: 20px; line-height: 1; }
    .name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .full { width: 100%; }
    mat-button-toggle-group.full mat-button-toggle { flex: 1; }
    .slider-row { display: flex; align-items: center; gap: 4px; }
    .grow { flex: 1; }
    .small { font-size: 18px; width: 18px; height: 18px; }
    .note { font: var(--mat-sys-body-small); margin: 0; }
  `,
})
export class AppearancePanelComponent {
  protected readonly prefs = inject(PreferencesStore);
  readonly reflowable = input(true);
  protected readonly original = ORIGINAL_FONT;
  protected readonly stack = fontStack;
  protected readonly percent = (v: number) => `${Math.round(v * 100)}%`;

  protected set(changes: Partial<ReaderPreferences>): void {
    void this.prefs.update(changes);
  }
}

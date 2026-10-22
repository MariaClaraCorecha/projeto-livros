import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DEFAULT_ICONS, ICON_CATALOG } from '../../../domain/defaults';
import { IconStyle } from '../../../domain/entities';
import { PreferencesStore } from '../../state/preferences.store';

@Component({
  selector: 'app-icons-tab',
  imports: [FormsModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule],
  template: `
    <section>
      <h2>Estilo dos ícones</h2>
      <p class="muted">Ícones Material Symbols do Google, usados como figurinhas nas anotações e nas estantes.</p>
      <mat-button-toggle-group [value]="style()" (change)="setStyle($event.value)">
        @for (s of styles; track s.id) {
          <mat-button-toggle [value]="s.id"><mat-icon [fontSet]="'material-symbols-' + s.id">favorite</mat-icon> {{ s.label }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
    </section>

    <section>
      <h2>Sua coleção <span class="muted count">{{ prefs.icons().length }}</span></h2>
      <div class="icon-grid">
        @for (i of prefs.icons(); track i) {
          <div class="icon-cell" [matTooltip]="i">
            <mat-icon [fontSet]="fontSet()">{{ i }}</mat-icon>
            @if (!isDefault(i)) {
              <button class="remove" (click)="prefs.removeIcon(i)" [attr.aria-label]="'Remover ' + i"><mat-icon>close</mat-icon></button>
            }
          </div>
        }
      </div>
    </section>

    <section>
      <h2>Pegar mais ícones</h2>
      <div class="search-row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Buscar ou digitar o nome do ícone</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Ex.: rocket_launch" (keydown.enter)="addTyped()" />
        </mat-form-field>
        @if (typed(); as name) {
          <div class="typed">
            <mat-icon [fontSet]="fontSet()">{{ name }}</mat-icon>
            <button mat-flat-button (click)="addTyped()" [disabled]="owned(name)">{{ owned(name) ? 'Na coleção' : 'Adicionar "' + name + '"' }}</button>
          </div>
        }
      </div>
      <p class="muted small">
        Veja todos os nomes em <a href="https://fonts.google.com/icons" target="_blank" rel="noopener">fonts.google.com/icons</a>
        — se o nome não existir, o ícone aparece como texto.
      </p>
      <div class="icon-grid">
        @for (i of results(); track i) {
          <button class="icon-cell pick" [class.owned]="owned(i)" (click)="prefs.addIcon(i)" [disabled]="owned(i)" [matTooltip]="i">
            <mat-icon [fontSet]="fontSet()">{{ i }}</mat-icon>
            @if (owned(i)) {
              <mat-icon class="tick">check_circle</mat-icon>
            }
          </button>
        }
      </div>
    </section>
  `,
  styleUrl: './customize-tabs.scss',
})
export class IconsTabComponent {
  protected readonly prefs = inject(PreferencesStore);
  protected readonly styles: { id: IconStyle; label: string }[] = [
    { id: 'outlined', label: 'Contorno' },
    { id: 'rounded', label: 'Arredondado' },
    { id: 'sharp', label: 'Reto' },
  ];
  protected readonly query = signal('');
  protected readonly style = computed(() => this.prefs.prefs()?.iconStyle ?? 'outlined');
  protected readonly fontSet = computed(() => `material-symbols-${this.style()}`);
  protected readonly results = computed(() => {
    const q = this.query().toLowerCase().trim().replace(/\s+/g, '_');
    return ICON_CATALOG.filter((i) => !q || i.includes(q));
  });
  protected readonly typed = computed(() => {
    const name = this.query().toLowerCase().trim().replace(/\s+/g, '_');
    return /^[a-z0-9_]{2,}$/.test(name) && !ICON_CATALOG.includes(name) ? name : null;
  });

  constructor() {
    // Garante que todos os estilos estejam disponíveis para a pré-visualização.
    for (const s of ['outlined', 'rounded', 'sharp'] as const) this.prefs.loadIconStyle(s);
  }

  protected isDefault(icon: string): boolean {
    return DEFAULT_ICONS.includes(icon);
  }

  protected owned(icon: string): boolean {
    return this.prefs.icons().includes(icon);
  }

  protected setStyle(iconStyle: IconStyle): void {
    void this.prefs.update({ iconStyle });
  }

  protected addTyped(): void {
    const name = this.typed() ?? this.query().trim();
    if (name) void this.prefs.addIcon(name).then(() => this.query.set(''));
  }
}

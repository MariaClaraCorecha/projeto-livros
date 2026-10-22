import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FontCategory, FontFamily, fontStack } from '../../../domain/entities';
import { FontCatalog } from '../../../application/ports';
import { PreferencesStore } from '../../state/preferences.store';

const PAGE = 24;

@Component({
  selector: 'app-fonts-tab',
  imports: [FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTooltipModule],
  template: `
    <section>
      <h2>Suas fontes</h2>
      <p class="muted">As fontes padrão já vêm no sistema. As que você adicionar do Google Fonts aparecem aqui e no leitor.</p>
      <mat-form-field appearance="outline" class="preview-field">
        <mat-label>Texto de exemplo</mat-label>
        <input matInput [(ngModel)]="sample" />
      </mat-form-field>
      <div class="font-grid">
        @for (f of prefs.fonts(); track f.family) {
          <article class="font-card" [class.active]="prefs.prefs()?.fontFamily === f.family">
            <div class="font-head">
              <strong>{{ f.family }}</strong>
              <span class="badge">{{ f.builtIn ? 'Padrão' : 'Google Fonts' }}</span>
            </div>
            <p class="sample" [style.font-family]="stack(f)">{{ sample }}</p>
            <div class="font-actions">
              <button mat-button (click)="use(f)" [disabled]="prefs.prefs()?.fontFamily === f.family">
                <mat-icon>{{ prefs.prefs()?.fontFamily === f.family ? 'check' : 'menu_book' }}</mat-icon>
                {{ prefs.prefs()?.fontFamily === f.family ? 'Em uso' : 'Usar na leitura' }}
              </button>
              @if (!f.builtIn) {
                <button mat-icon-button (click)="prefs.removeFont(f.family)" matTooltip="Remover" aria-label="Remover fonte">
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </div>
          </article>
        }
      </div>
    </section>

    <section>
      <h2>Adicionar do Google Fonts</h2>
      <div class="search-row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Buscar fonte</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [ngModel]="query()" (ngModelChange)="query.set($event); limit.set(page)" />
        </mat-form-field>
      </div>
      <mat-chip-listbox [value]="category()" (change)="category.set($event.value ?? null); limit.set(page)" aria-label="Categoria">
        @for (c of categories; track c.id) {
          <mat-chip-option [value]="c.id">{{ c.label }}</mat-chip-option>
        }
      </mat-chip-listbox>
      @if (!catalog.complete) {
        <p class="muted small">
          Mostrando uma seleção de famílias. Para listar o catálogo completo, defina <code>googleFontsApiKey</code> no environment —
          ou adicione qualquer fonte pelo nome abaixo.
        </p>
      }

      <div class="font-grid">
        @for (f of shown(); track f.family) {
          <article class="font-card">
            <div class="font-head">
              <strong>{{ f.family }}</strong>
              <span class="badge">{{ categoryLabel(f.category) }}</span>
            </div>
            <p class="sample" [style.font-family]="stack(f)">{{ sample }}</p>
            <div class="font-actions">
              @if (has(f.family)) {
                <span class="muted added"><mat-icon>check</mat-icon> Adicionada</span>
              } @else {
                <button mat-stroked-button (click)="add(f)" [disabled]="busy() === f.family"><mat-icon>add</mat-icon> Adicionar</button>
              }
            </div>
          </article>
        } @empty {
          <p class="muted">Nenhuma fonte encontrada. Tente adicionar pelo nome.</p>
        }
      </div>
      @if (filtered().length > shown().length) {
        <button mat-button class="more" (click)="limit.set(limit() + page)">Mostrar mais ({{ filtered().length - shown().length }})</button>
      }
    </section>

    <section>
      <h2>Adicionar pelo nome</h2>
      <p class="muted">Digite o nome exato de qualquer família do <a href="https://fonts.google.com" target="_blank" rel="noopener">fonts.google.com</a>.</p>
      <div class="search-row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Família</mat-label>
          <input matInput [(ngModel)]="customName" placeholder="Ex.: Noto Serif Display" (keydown.enter)="addCustom()" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Categoria</mat-label>
          <mat-select [(ngModel)]="customCategory">
            @for (c of categories.slice(1); track c.id) {
              <mat-option [value]="c.id">{{ c.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button (click)="addCustom()" [disabled]="!customName.trim() || !!busy()">Adicionar</button>
      </div>
    </section>
  `,
  styleUrl: './customize-tabs.scss',
})
export class FontsTabComponent {
  protected readonly prefs = inject(PreferencesStore);
  protected readonly catalog = inject(FontCatalog);
  private readonly snack = inject(MatSnackBar);

  protected readonly stack = fontStack;
  protected readonly page = PAGE;
  protected sample = 'A leitura é uma conversa com os melhores homens dos séculos passados.';
  protected customName = '';
  protected customCategory: FontCategory = 'serif';

  protected readonly categories: { id: FontCategory | null; label: string }[] = [
    { id: null, label: 'Todas' },
    { id: 'serif', label: 'Serifadas' },
    { id: 'sans-serif', label: 'Sem serifa' },
    { id: 'display', label: 'Decorativas' },
    { id: 'handwriting', label: 'Manuscritas' },
    { id: 'monospace', label: 'Monoespaçadas' },
  ];

  protected readonly all = signal<FontFamily[]>([]);
  protected readonly query = signal('');
  protected readonly category = signal<FontCategory | null>(null);
  protected readonly limit = signal(PAGE);
  protected readonly busy = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    return this.all().filter((f) => (!this.category() || f.category === this.category()) && (!q || f.family.toLowerCase().includes(q)));
  });
  protected readonly shown = computed(() => this.filtered().slice(0, this.limit()));

  constructor() {
    void this.catalog.list().then((list) => this.all.set(list));
    // Carrega só as fontes visíveis para a pré-visualização.
    effect(() => {
      for (const f of [...this.shown(), ...this.prefs.fonts()]) void this.prefs.loadFont(f);
    });
  }

  protected has(family: string): boolean {
    return this.prefs.fonts().some((f) => f.family.toLowerCase() === family.toLowerCase());
  }

  protected categoryLabel(id: FontCategory): string {
    return this.categories.find((c) => c.id === id)?.label ?? id;
  }

  protected use(f: FontFamily): void {
    void this.prefs.update({ fontFamily: f.family });
    this.snack.open(`"${f.family}" será usada na leitura.`);
  }

  protected async add(f: Pick<FontFamily, 'family' | 'category'>): Promise<boolean> {
    this.busy.set(f.family);
    try {
      await this.prefs.addFont(f);
      this.snack.open(`Fonte "${f.family}" adicionada.`, 'Usar agora').onAction().subscribe(() => this.prefs.update({ fontFamily: f.family }));
      return true;
    } catch (e) {
      this.snack.open(e instanceof Error ? e.message : 'Não foi possível adicionar a fonte.', 'OK');
      return false;
    } finally {
      this.busy.set(null);
    }
  }

  protected async addCustom(): Promise<void> {
    const family = this.customName.trim().replace(/\s+/g, ' ');
    if (!family) return;
    if (await this.add({ family, category: this.customCategory })) this.customName = '';
  }
}

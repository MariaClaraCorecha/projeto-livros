import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Shelf } from '../../domain/entities';
import { PreferencesStore } from '../state/preferences.store';

export type ShelfDialogResult = Pick<Shelf, 'name' | 'color' | 'icon'>;

const COLORS = ['#a0522d', '#c0392b', '#e67e22', '#d4a017', '#27ae60', '#16a085', '#2980b9', '#3949ab', '#8e44ad', '#d81b60', '#546e7a', '#212121'];
const SHELF_ICONS = ['shelves', 'menu_book', 'auto_stories', 'favorite', 'star', 'school', 'science', 'history_edu', 'psychology', 'rocket_launch', 'castle', 'skull', 'child_care', 'work', 'savings', 'local_florist'];

@Component({
  selector: 'app-shelf-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Editar estante' : 'Nova estante' }}</h2>
    <mat-dialog-content class="dialog-body">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Nome</mat-label>
        <input matInput [(ngModel)]="name" maxlength="40" required cdkFocusInitial (keydown.enter)="save()" />
      </mat-form-field>

      <span class="label">Cor</span>
      <div class="swatches">
        @for (c of colors; track c) {
          <button type="button" class="swatch" [style.background]="c" [class.selected]="color() === c"
                  (click)="color.set(c)" [attr.aria-label]="'Cor ' + c"></button>
        }
        <input type="color" class="custom-color" [value]="color()" (input)="color.set($any($event.target).value)" aria-label="Outra cor" />
      </div>

      <span class="label">Ícone</span>
      <div class="icons">
        @for (i of icons; track i) {
          <button mat-icon-button type="button" [class.selected]="icon() === i" (click)="icon.set(i)" [attr.aria-label]="i">
            <mat-icon [fontSet]="iconSet()">{{ i }}</mat-icon>
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button (click)="save()" [disabled]="!name.trim()">Salvar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .label { font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); }
    .swatches, .icons { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .swatch { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
      outline: 2px solid transparent; outline-offset: 2px; }
    .swatch.selected { outline-color: var(--mat-sys-primary); }
    .custom-color { width: 34px; height: 34px; border: none; background: none; padding: 0; cursor: pointer; }
    .icons .selected { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
  `,
})
export class ShelfDialog {
  protected readonly data = inject<Shelf | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ShelfDialog, ShelfDialogResult>>(MatDialogRef);
  private readonly prefs = inject(PreferencesStore);

  protected readonly colors = COLORS;
  protected readonly icons = Array.from(new Set([...SHELF_ICONS, ...this.prefs.icons()]));
  protected readonly iconSet = () => `material-symbols-${this.prefs.prefs()?.iconStyle ?? 'outlined'}`;
  protected name = this.data?.name ?? '';
  protected readonly color = signal(this.data?.color ?? COLORS[0]);
  protected readonly icon = signal(this.data?.icon ?? SHELF_ICONS[0]);

  protected save(): void {
    if (!this.name.trim()) return;
    this.ref.close({ name: this.name.trim(), color: this.color(), icon: this.icon() });
  }
}

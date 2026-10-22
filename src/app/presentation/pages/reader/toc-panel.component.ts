import { Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TocItem } from '../../../application/ports';

@Component({
  selector: 'app-toc-panel',
  imports: [NgTemplateOutlet, MatIconModule],
  template: `
    <ng-template #list let-items let-depth="depth">
      @for (item of items; track $index) {
        <button class="entry" [style.padding-left.px]="16 + depth * 16" (click)="navigate.emit(item.target)">
          {{ item.label }}
        </button>
        @if (item.children.length) {
          <ng-container *ngTemplateOutlet="list; context: { $implicit: item.children, depth: depth + 1 }" />
        }
      }
    </ng-template>

    @if (items().length) {
      <ng-container *ngTemplateOutlet="list; context: { $implicit: items(), depth: 0 }" />
    } @else {
      <div class="empty"><mat-icon>toc</mat-icon><p>Este livro não tem sumário.</p></div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; padding: 4px 0 24px; }
    .entry { border: none; background: none; color: inherit; text-align: left; padding: 10px 16px; cursor: pointer;
      font: var(--mat-sys-body-medium); border-radius: 0 20px 20px 0; margin-right: 8px; }
    .entry:hover { background: var(--mat-sys-surface-container-high); }
    .empty { text-align: center; padding: 32px; color: var(--mat-sys-on-surface-variant); }
  `,
})
export class TocPanelComponent {
  readonly items = input.required<TocItem[]>();
  readonly navigate = output<string>();
}

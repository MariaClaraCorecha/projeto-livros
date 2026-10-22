import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { AppearancePanelComponent } from '../reader/appearance-panel.component';
import { FontsTabComponent } from './fonts-tab.component';
import { HighlightersTabComponent } from './highlighters-tab.component';
import { IconsTabComponent } from './icons-tab.component';
import { StickersTabComponent } from './stickers-tab.component';

const TABS = ['fontes', 'icones', 'marca-textos', 'figurinhas', 'aparencia'] as const;

@Component({
  selector: 'app-customize-page',
  imports: [MatTabsModule, MatIconModule, FontsTabComponent, IconsTabComponent, HighlightersTabComponent, StickersTabComponent, AppearancePanelComponent],
  template: `
    <div class="customize">
      <h1 class="display-title">Personalizar</h1>
      <p class="muted">Deixe a leitura com a sua cara: fontes do Google, ícones, marca-textos, figurinhas e papéis.</p>
      <mat-tab-group [selectedIndex]="index()" (selectedIndexChange)="select($event)" mat-stretch-tabs="false" animationDuration="150ms">
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>text_fields</mat-icon> Fontes</ng-template>
          <ng-template matTabContent><app-fonts-tab /></ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>interests</mat-icon> Ícones</ng-template>
          <ng-template matTabContent><app-icons-tab /></ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>ink_highlighter</mat-icon> Marca-textos</ng-template>
          <ng-template matTabContent><app-highlighters-tab /></ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>add_reaction</mat-icon> Figurinhas</ng-template>
          <ng-template matTabContent><app-stickers-tab /></ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>palette</mat-icon> Leitura e tema</ng-template>
          <ng-template matTabContent>
            <div class="appearance"><app-appearance-panel /></div>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: `
    .customize { padding: 24px clamp(16px, 4vw, 48px) 64px; max-width: 1200px; }
    h1 { margin: 0; font-size: 30px; }
    p { margin: 4px 0 16px; }
    mat-icon { margin-right: 8px; }
    .appearance { max-width: 480px; padding-top: 12px; }
  `,
})
export class CustomizePage {
  private readonly router = inject(Router);
  /** Query param `?aba=`. */
  readonly aba = input<string | undefined>();
  protected readonly index = computed(() => Math.max(0, TABS.indexOf((this.aba() ?? 'fontes') as (typeof TABS)[number])));

  protected select(index: number): void {
    void this.router.navigate([], { queryParams: { aba: TABS[index] }, replaceUrl: true });
  }
}

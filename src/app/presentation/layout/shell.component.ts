import { Component, computed, inject, viewChild } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Shelf, ThemeMode } from '../../domain/entities';
import { ShelfDialog, ShelfDialogResult } from '../dialogs/shelf.dialog';
import { LibraryStore } from '../state/library.store';
import { PreferencesStore } from '../state/preferences.store';
import { SessionStore } from '../state/session.store';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, CdkDropList, CdkDrag,
    MatSidenavModule, MatToolbarModule, MatButtonModule, MatIconModule, MatListModule, MatMenuModule, MatDividerModule, MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly session = inject(SessionStore);
  protected readonly library = inject(LibraryStore);
  protected readonly prefs = inject(PreferencesStore);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sidenav = viewChild.required(MatSidenav);

  protected readonly mobile = toSignal(
    inject(BreakpointObserver).observe('(max-width: 900px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  private readonly params = toSignal(this.router.routerState.root.queryParamMap, { requireSync: true });
  protected readonly currentShelf = computed(() => this.params().get('estante') ?? 'todos');
  protected readonly onLibrary = toSignal(this.router.events.pipe(map(() => this.router.url.split('?')[0] === '/')), {
    initialValue: this.router.url.split('?')[0] === '/',
  });

  protected readonly themeModes: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Claro', icon: 'light_mode' },
    { mode: 'dark', label: 'Escuro', icon: 'dark_mode' },
    { mode: 'system', label: 'Do sistema', icon: 'contrast' },
  ];

  protected readonly smartShelves = [
    { id: 'todos', label: 'Toda a estante', icon: 'shelves' },
    { id: 'lendo', label: 'Lendo agora', icon: 'auto_stories' },
    { id: 'favoritos', label: 'Favoritos', icon: 'favorite' },
    { id: 'sem-estante', label: 'Sem estante', icon: 'inventory_2' },
  ];

  protected count(id: string): number {
    const books = this.library.books();
    switch (id) {
      case 'todos':
        return books.length;
      case 'lendo':
        return this.library.reading().length;
      case 'favoritos':
        return books.filter((b) => b.favorite).length;
      case 'sem-estante':
        return books.filter((b) => b.shelfId === null).length;
      default:
        return books.filter((b) => b.shelfId === id).length;
    }
  }

  protected isActive(id: string): boolean {
    return this.onLibrary() && this.currentShelf() === id;
  }

  protected closeOnMobile(): void {
    if (this.mobile()) void this.sidenav().close();
  }

  protected onSearch(value: string): void {
    this.library.query.set(value);
    if (!this.onLibrary()) void this.router.navigate(['/'], { relativeTo: this.route });
  }

  protected setTheme(mode: ThemeMode): void {
    void this.prefs.update({ themeMode: mode });
  }

  protected createShelf(): void {
    this.dialog
      .open<ShelfDialog, Shelf | null, ShelfDialogResult>(ShelfDialog, { data: null, width: '440px' })
      .afterClosed()
      .subscribe(async (result) => {
        if (!result) return;
        const shelf = await this.library.createShelf(result);
        void this.router.navigate(['/'], { queryParams: { estante: shelf.id } });
      });
  }

  protected dropShelf(event: CdkDragDrop<Shelf[]>): void {
    const list = [...this.library.shelves()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    void this.library.reorderShelves(list);
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigateByUrl('/login');
  }
}

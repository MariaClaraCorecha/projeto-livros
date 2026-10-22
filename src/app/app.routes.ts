import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './presentation/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Entrar · Estante',
    loadComponent: () => import('./presentation/pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'ler/:id',
    canActivate: [authGuard],
    title: 'Lendo · Estante',
    loadComponent: () => import('./presentation/pages/reader/reader.page').then((m) => m.ReaderPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./presentation/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        title: 'Minha estante',
        loadComponent: () => import('./presentation/pages/library/library.page').then((m) => m.LibraryPage),
      },
      {
        path: 'personalizar',
        title: 'Personalizar · Estante',
        loadComponent: () => import('./presentation/pages/customize/customize.page').then((m) => m.CustomizePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../state/session.store';

export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  return session.loggedIn() || router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  await session.whenReady();
  return !session.loggedIn() || router.createUrlTree(['/']);
};

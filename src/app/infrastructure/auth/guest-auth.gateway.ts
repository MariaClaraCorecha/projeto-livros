import { Injectable, signal } from '@angular/core';
import { User } from '../../domain/entities';
import { AuthGateway } from '../../domain/repositories';
import { clearGuestSession, GUEST_USER, readGuestSession, saveGuestSession } from './guest-session';

/**
 * Usado apenas quando o `googleClientId` ainda não foi configurado em `environment.ts`,
 * para que o app possa ser testado localmente.
 */
@Injectable()
export class GuestAuthGateway extends AuthGateway {
  readonly googleAvailable = false;
  readonly user = signal<User | null>(readGuestSession());
  readonly ready = signal(true);

  signInWithGoogle(): Promise<User> {
    return Promise.reject(
      new Error('Configure o googleClientId em src/environments/environment.ts para entrar com o Google.'),
    );
  }

  async signInAsGuest(): Promise<User> {
    saveGuestSession();
    this.user.set(GUEST_USER);
    return GUEST_USER;
  }

  async signOut(): Promise<void> {
    clearGuestSession();
    this.user.set(null);
  }
}

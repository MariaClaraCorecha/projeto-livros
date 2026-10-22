import { Injectable, signal } from '@angular/core';
import { User } from '../../domain/entities';
import { AuthGateway } from '../../domain/repositories';

const STORAGE_KEY = 'estante.guest-session';

/**
 * Usado apenas quando o Firebase ainda não foi configurado em `environment.ts`,
 * para que o app possa ser testado localmente.
 */
@Injectable()
export class GuestAuthGateway extends AuthGateway {
  readonly googleAvailable = false;
  readonly user = signal<User | null>(readSession());
  readonly ready = signal(true);

  signInWithGoogle(): Promise<User> {
    return Promise.reject(
      new Error('Configure o Firebase em src/environments/environment.ts para entrar com o Google.'),
    );
  }

  async signInAsGuest(): Promise<User> {
    const user: User = { id: 'guest', name: 'Convidado', email: null, photoUrl: null, isGuest: true };
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* armazenamento indisponível: sessão vale só nesta aba */
    }
    this.user.set(user);
    return user;
  }

  async signOut(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignora */
    }
    this.user.set(null);
  }
}

function readSession(): User | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
      ? { id: 'guest', name: 'Convidado', email: null, photoUrl: null, isGuest: true }
      : null;
  } catch {
    return null;
  }
}

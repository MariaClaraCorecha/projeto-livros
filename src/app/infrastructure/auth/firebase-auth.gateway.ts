import { Injectable, signal } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { User } from '../../domain/entities';
import { AuthGateway } from '../../domain/repositories';
import { clearGuestSession, GUEST_USER, readGuestSession, saveGuestSession } from './guest-session';

/** Erros do popup que podem ser contornados entrando por redirecionamento. */
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

/** Autenticação com conta Google via Firebase Authentication, com opção de entrar como visitante. */
@Injectable()
export class FirebaseAuthGateway extends AuthGateway {
  readonly googleAvailable = true;
  readonly user = signal<User | null>(readGuestSession());
  readonly ready = signal(false);

  // `getApps()` evita "app already exists" quando o módulo é recarregado pelo dev server.
  private readonly app: FirebaseApp = getApps().length ? getApp() : initializeApp(environment.firebase);
  private readonly auth: Auth = getAuth(this.app);
  private readonly persistence = setPersistence(this.auth, browserLocalPersistence).catch((e) =>
    console.warn('[auth] Não foi possível manter a sessão salva:', e),
  );

  constructor() {
    super();
    this.auth.languageCode = 'pt-BR';
    onAuthStateChanged(this.auth, (fbUser) => {
      if (fbUser) clearGuestSession();
      this.user.set(fbUser ? toUser(fbUser) : readGuestSession());
      this.ready.set(true);
    });
    // Conclui um login iniciado por redirecionamento (fallback do popup).
    getRedirectResult(this.auth).catch((e) => console.error('[auth] Falha no retorno do login com Google:', e));
  }

  async signInWithGoogle(): Promise<User> {
    await this.persistence;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const credential = await signInWithPopup(this.auth, provider);
      clearGuestSession();
      const user = toUser(credential.user);
      this.user.set(user);
      return user;
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (REDIRECT_FALLBACK_CODES.has(code)) {
        await signInWithRedirect(this.auth, provider);
        // A página é redirecionada para o Google; esta promessa não precisa resolver.
        return new Promise<User>(() => {});
      }
      console.error('[auth] Falha no login com Google:', e);
      throw e;
    }
  }

  async signInAsGuest(): Promise<User> {
    saveGuestSession();
    this.user.set(GUEST_USER);
    return GUEST_USER;
  }

  async signOut(): Promise<void> {
    clearGuestSession();
    if (this.auth.currentUser) await signOut(this.auth);
    this.user.set(null);
  }
}

function toUser(fbUser: FirebaseUser): User {
  return {
    id: fbUser.uid,
    name: fbUser.displayName ?? fbUser.email ?? 'Leitor',
    email: fbUser.email,
    photoUrl: fbUser.photoURL,
    isGuest: false,
  };
}

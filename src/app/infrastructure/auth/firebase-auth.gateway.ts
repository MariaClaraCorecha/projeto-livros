import { Injectable, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { User } from '../../domain/entities';
import { AuthGateway } from '../../domain/repositories';

/** Autenticação com conta Google via Firebase Authentication. */
@Injectable()
export class FirebaseAuthGateway extends AuthGateway {
  readonly googleAvailable = true;
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);

  private readonly app: FirebaseApp = initializeApp(environment.firebase);
  private readonly auth: Auth = getAuth(this.app);

  constructor() {
    super();
    this.auth.languageCode = 'pt-BR';
    void setPersistence(this.auth, browserLocalPersistence);
    onAuthStateChanged(this.auth, (fbUser) => {
      this.user.set(fbUser ? toUser(fbUser) : null);
      this.ready.set(true);
    });
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(this.auth, provider);
    const user = toUser(credential.user);
    this.user.set(user);
    return user;
  }

  signInAsGuest(): Promise<User> {
    return Promise.reject(new Error('O modo convidado só existe quando o Firebase não está configurado.'));
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
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

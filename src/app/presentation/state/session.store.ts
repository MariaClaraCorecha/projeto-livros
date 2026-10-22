import { computed, inject, Injectable } from '@angular/core';
import { AuthGateway } from '../../domain/repositories';
import { SignInAsGuestUseCase, SignInWithGoogleUseCase, SignOutUseCase } from '../../application/use-cases';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly auth = inject(AuthGateway);
  private readonly googleSignIn = inject(SignInWithGoogleUseCase);
  private readonly guestSignIn = inject(SignInAsGuestUseCase);
  private readonly signOutUseCase = inject(SignOutUseCase);

  readonly user = this.auth.user;
  readonly ready = this.auth.ready;
  readonly loggedIn = computed(() => this.user() !== null);
  readonly googleAvailable = this.auth.googleAvailable;

  /** Resolve quando o estado de autenticação inicial estiver disponível. */
  whenReady(): Promise<void> {
    if (this.ready()) return Promise.resolve();
    return new Promise((resolve) => {
      const id = setInterval(() => {
        if (this.ready()) {
          clearInterval(id);
          resolve();
        }
      }, 25);
    });
  }

  signInWithGoogle() {
    return this.googleSignIn.execute();
  }

  signInAsGuest() {
    return this.guestSignIn.execute();
  }

  signOut() {
    return this.signOutUseCase.execute();
  }
}

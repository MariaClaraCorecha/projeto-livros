import { inject, Injectable } from '@angular/core';
import { User } from '../../domain/entities';
import { AuthGateway } from '../../domain/repositories';

@Injectable({ providedIn: 'root' })
export class SignInWithGoogleUseCase {
  private readonly auth = inject(AuthGateway);
  execute(): Promise<User> {
    return this.auth.signInWithGoogle();
  }
}

@Injectable({ providedIn: 'root' })
export class SignInAsGuestUseCase {
  private readonly auth = inject(AuthGateway);
  execute(): Promise<User> {
    return this.auth.signInAsGuest();
  }
}

@Injectable({ providedIn: 'root' })
export class SignOutUseCase {
  private readonly auth = inject(AuthGateway);
  execute(): Promise<void> {
    return this.auth.signOut();
  }
}

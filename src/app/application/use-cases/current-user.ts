import { inject, Injectable } from '@angular/core';
import { AuthGateway } from '../../domain/repositories';

/** Fornece o id do usuário logado para os casos de uso. */
@Injectable({ providedIn: 'root' })
export class CurrentUser {
  private readonly auth = inject(AuthGateway);

  id(): string {
    const user = this.auth.user();
    if (!user) throw new Error('Usuário não autenticado.');
    return user.id;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

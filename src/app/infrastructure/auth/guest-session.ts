import { User } from '../../domain/entities';

const STORAGE_KEY = 'estante.guest-session';

/** Sessão de visitante: fica só neste navegador, sem conta Google. */
export const GUEST_USER: User = { id: 'guest', name: 'Visitante', email: null, photoUrl: null, isGuest: true };

export function readGuestSession(): User | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ? GUEST_USER : null;
  } catch {
    return null;
  }
}

export function saveGuestSession(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* armazenamento indisponível: sessão vale só nesta aba */
  }
}

export function clearGuestSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
}

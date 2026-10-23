import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { User } from '../../domain/entities';
import { AuthGateway } from '../../domain/repositories';
import { clearGuestSession, GUEST_USER, readGuestSession, saveGuestSession } from './guest-session';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SCOPES = 'openid email profile';
const STORAGE_KEY = 'estante.google-session';

/** Erro com `code`, no mesmo formato usado pela tela de login para traduzir mensagens. */
export class GoogleAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Autenticação com conta Google via Google Identity Services (OAuth 2.0, cliente Web),
 * com opção de entrar como visitante. O app não tem backend: o perfil retornado pelo
 * Google é guardado neste navegador e o token de acesso é usado só para lê-lo.
 */
@Injectable()
export class GoogleIdentityGateway extends AuthGateway {
  readonly googleAvailable = true;
  readonly user = signal<User | null>(readGoogleSession() ?? readGuestSession());
  readonly ready = signal(true);

  private accessToken: string | null = null;

  async signInWithGoogle(): Promise<User> {
    const oauth2 = await loadGis();
    const token = await new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: environment.googleClientId,
        scope: SCOPES,
        prompt: 'select_account',
        callback: (response) =>
          response.error
            ? reject(new GoogleAuthError(`google/${response.error}`, response.error_description ?? response.error))
            : resolve(response),
        error_callback: (error) => reject(new GoogleAuthError(`google/${error.type}`, error.message)),
      });
      client.requestAccessToken();
    });

    const user = await fetchProfile(token.access_token);
    this.accessToken = token.access_token;
    clearGuestSession();
    saveGoogleSession(user);
    this.user.set(user);
    return user;
  }

  async signInAsGuest(): Promise<User> {
    clearGoogleSession();
    saveGuestSession();
    this.user.set(GUEST_USER);
    return GUEST_USER;
  }

  async signOut(): Promise<void> {
    clearGuestSession();
    clearGoogleSession();
    if (this.accessToken) {
      const token = this.accessToken;
      this.accessToken = null;
      loadGis()
        .then((oauth2) => oauth2.revoke(token))
        .catch(() => {
          /* o token expira sozinho em ~1h */
        });
    }
    this.user.set(null);
  }
}

let gisLoading: Promise<typeof google.accounts.oauth2> | null = null;

/** Carrega o script do Google Identity Services uma única vez. */
function loadGis(): Promise<typeof google.accounts.oauth2> {
  if (typeof google !== 'undefined' && google.accounts?.oauth2) return Promise.resolve(google.accounts.oauth2);
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(google.accounts.oauth2);
    script.onerror = () => {
      gisLoading = null;
      reject(new GoogleAuthError('google/script-load-failed', 'Não foi possível carregar o login do Google.'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

async function fetchProfile(accessToken: string): Promise<User> {
  let response: Response;
  try {
    response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new GoogleAuthError('google/network-request-failed', 'Falha de rede ao falar com o Google.');
  }
  if (!response.ok) {
    throw new GoogleAuthError('google/userinfo-failed', `O Google não retornou o perfil (HTTP ${response.status}).`);
  }
  const profile = (await response.json()) as { sub: string; name?: string; email?: string; picture?: string };
  return {
    id: profile.sub,
    name: profile.name ?? profile.email ?? 'Leitor',
    email: profile.email ?? null,
    photoUrl: profile.picture ?? null,
    isGuest: false,
  };
}

function readGoogleSession(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function saveGoogleSession(user: User): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* armazenamento indisponível: sessão vale só nesta aba */
  }
}

function clearGoogleSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
}

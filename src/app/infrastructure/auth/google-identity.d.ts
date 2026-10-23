/** Tipos mínimos do Google Identity Services (https://accounts.google.com/gsi/client) usados pelo app. */
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    error?: string;
    error_description?: string;
  }

  interface ClientConfigError {
    type: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
    message: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    prompt?: '' | 'none' | 'consent' | 'select_account';
    callback: (response: TokenResponse) => void;
    error_callback?: (error: ClientConfigError) => void;
  }

  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(accessToken: string, done?: () => void): void;
}

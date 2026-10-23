import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SessionStore } from '../../state/session.store';

@Component({
  selector: 'app-login-page',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  protected readonly busy = signal(false);

  protected readonly spines = [
    { h: 78, c: '#c0392b' }, { h: 92, c: '#2c3e50' }, { h: 70, c: '#d4a017' }, { h: 86, c: '#16a085' },
    { h: 64, c: '#8e44ad' }, { h: 95, c: '#e67e22' }, { h: 74, c: '#2980b9' }, { h: 88, c: '#7f8c8d' },
    { h: 68, c: '#27ae60' }, { h: 82, c: '#a0522d' },
  ];

  protected async google(): Promise<void> {
    await this.run(() => this.session.signInWithGoogle());
  }

  protected async guest(): Promise<void> {
    await this.run(() => this.session.signInAsGuest());
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      await this.router.navigateByUrl('/');
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.snack.open(signInErrorMessage(e), 'OK', { duration: 10000 });
      }
    } finally {
      this.busy.set(false);
    }
  }
}

/** Traduz os erros mais comuns do Firebase Auth; os demais mostram o código para facilitar o diagnóstico. */
function signInErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code;
  switch (code) {
    case 'auth/unauthorized-domain':
      return `Este endereço (${location.hostname}) não está autorizado no Firebase. Adicione-o em Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'O login com Google não está ativado no Firebase (Authentication → Sign-in method).';
    case 'auth/network-request-failed':
      return 'Falha de rede ao falar com o Google. Verifique a conexão, extensões de bloqueio ou o firewall.';
    case 'auth/internal-error':
      return 'O Google recusou o login. Verifique se o navegador bloqueia cookies de terceiros ou pop-ups. (auth/internal-error)';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com este e-mail usando outro método de login.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada no Firebase.';
  }
  const message = e instanceof Error ? e.message : 'Não foi possível entrar.';
  return code && !message.includes(code) ? `${message} (${code})` : message;
}

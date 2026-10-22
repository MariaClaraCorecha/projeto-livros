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
        this.snack.open(e instanceof Error ? e.message : 'Não foi possível entrar.', 'OK', { duration: 6000 });
      }
    } finally {
      this.busy.set(false);
    }
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/en';
import { TParams } from '../../core/i18n/types';

/**
 * Shown instead of the whole app shell whenever the caller has neither a local-network pass
 * nor a valid login cookie (see App / AuthService.hasAccess).
 */
@Component({
  selector: 'app-login-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <form class="dialog card" (submit)="submit($event)">
        <div class="logo"></div>
        <h1 class="dialog-title">{{ t('login.title') }}</h1>
        <p class="dialog-sub">{{ t('login.sub') }}</p>

        <label class="lbl">{{ t('login.username') }}</label>
        <input class="input" name="username" [value]="username()" (input)="username.set(value($event))"
               autocomplete="username" autofocus>

        <label class="lbl">{{ t('login.password') }}</label>
        <input class="input" type="password" name="password" [value]="password()" (input)="password.set(value($event))"
               autocomplete="current-password">

        @if (error(); as err) {
          <p class="err">{{ err }}</p>
        }

        <button type="submit" class="btn btn-primary submit" [disabled]="busy() || !username().trim() || !password()">
          {{ t('login.submit') }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .page {
      height: 100%;
      display: grid;
      place-items: center;
      background: var(--color-bg);
    }
    .card { display: flex; flex-direction: column; width: 360px; }
    .logo {
      width: 20px; height: 20px; margin-bottom: var(--space-4);
      background: var(--color-accent);
      box-shadow: 0 0 16px -1px var(--color-accent);
    }
    .lbl {
      font-family: var(--font-mono); font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted); margin: var(--space-3) 0 var(--space-1);
    }
    .err { margin: var(--space-3) 0 0; font-family: var(--font-mono); font-size: 12px; color: var(--color-danger); }
    .submit { margin-top: var(--space-5); }
  `],
})
export class LoginViewComponent {
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  t = (key: TranslationKey, params?: TParams): string => this.i18n.t(key, params);

  readonly username = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  value(e: Event): string { return (e.target as HTMLInputElement).value; }

  async submit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.username(), this.password());
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      this.error.set(this.t(status === 500 ? 'login.error.notConfigured' : 'login.error'));
      this.password.set('');
    } finally {
      this.busy.set(false);
    }
  }
}

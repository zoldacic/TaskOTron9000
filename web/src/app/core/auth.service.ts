import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api-base';
import { AuthStatus } from '../models';

/**
 * Gates the whole app: a request from the local network gets full access outright (single-user
 * system, no need to log in at home); anything else needs the login cookie from /api/auth/login.
 * The backend enforces this on every endpoint — `hasAccess` here only drives what the UI shows.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = API_BASE;

  /** Null until the first /status check resolves — the shell stays hidden meanwhile. */
  private readonly status = signal<AuthStatus | null>(null);
  readonly checked = computed(() => this.status() !== null);
  readonly isLocal = computed(() => this.status()?.isLocal ?? false);
  readonly authenticated = computed(() => this.status()?.authenticated ?? false);
  readonly hasAccess = computed(() => this.isLocal() || this.authenticated());

  // withCredentials (needed once the frontend and API are on different origins) is added to
  // every request by httpAuthInterceptor, so calls below don't repeat it.

  async refreshStatus(): Promise<void> {
    this.status.set(await firstValueFrom(this.http.get<AuthStatus>(`${this.base}/api/auth/status`)));
  }

  /** Throws (HttpErrorResponse, 401) on bad credentials — the login form shows an inline error. */
  async login(username: string, password: string): Promise<void> {
    this.status.set(await firstValueFrom(
      this.http.post<AuthStatus>(`${this.base}/api/auth/login`, { username, password })));
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/api/auth/logout`, {}));
    await this.refreshStatus();
  }

  /** Called by the interceptor when any API call comes back 401 — e.g. the cookie expired mid-session. */
  markLoggedOut(): void {
    const s = this.status();
    if (s?.authenticated) this.status.set({ ...s, authenticated: false });
  }
}

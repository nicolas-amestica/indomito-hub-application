import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, AuthPermission, AuthSession } from './auth.models';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly storageKey = 'indomito.auth.session';

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<AuthSession | null>(this.restoreSession());
  readonly session = this.state.asReadonly();
  readonly authenticated = computed(() => !!this.state()?.token);
  readonly user = computed(() => this.state()?.user ?? null);
  readonly permissions = computed(() => this.state()?.permissions ?? []);
  readonly modules = computed(() =>
    this.permissions()
      .filter((p) => p.module.active)
      .sort((a, b) => a.module.order - b.module.order)
      .map((p) => p.module),
  );
  async login(login: string, password: string): Promise<void> {
    const session = await firstValueFrom(
      this.http
        .post<ApiEnvelope<AuthSession>>(`${environment.apiUrl}/auth/login`, { login, password })
        .pipe(map((x) => x.data)),
    );
    this.setSession(session);
    await this.router.navigateByUrl(session.permissions[0]?.module.path || '/programas');
  }
  token(): string | null {
    return this.state()?.token ?? null;
  }
  canAccess(code: string): boolean {
    return this.permissions().some((p) => p.module.code === code && p.allowances.includes('r'));
  }
  logout(): void {
    this.state.set(null);
    this.removeStoredSession();
    void this.router.navigateByUrl('/login');
  }

  private setSession(session: AuthSession): void {
    this.state.set(session);

    try {
      this.document.defaultView?.sessionStorage.setItem(
        AuthService.storageKey,
        JSON.stringify(session),
      );
    } catch {
      // La sesión sigue funcionando en memoria si el navegador bloquea el storage.
    }
  }

  private restoreSession(): AuthSession | null {
    try {
      const serialized = this.document.defaultView?.sessionStorage.getItem(AuthService.storageKey);
      if (!serialized) return null;

      const session = JSON.parse(serialized) as unknown;
      if (!isValidStoredSession(session) || isExpiredJwt(session.token)) {
        this.removeStoredSession();
        return null;
      }

      return session;
    } catch {
      this.removeStoredSession();
      return null;
    }
  }

  private removeStoredSession(): void {
    try {
      this.document.defaultView?.sessionStorage.removeItem(AuthService.storageKey);
    } catch {
      // Un storage inaccesible tampoco conserva una sesión que debamos limpiar.
    }
  }
}

function isValidStoredSession(value: unknown): value is AuthSession {
  if (value === null || typeof value !== 'object') return false;

  const session = value as Partial<AuthSession>;
  return (
    typeof session.token === 'string' &&
    session.token.length > 0 &&
    session.user !== null &&
    typeof session.user === 'object' &&
    Array.isArray(session.permissions)
  );
}

function isExpiredJwt(token: string): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;

    const normalized = payloadPart.replace(/-/gu, '+').replace(/_/gu, '/');
    const payload = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    ) as {
      exp?: unknown;
    };

    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

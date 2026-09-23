import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, AuthPermission, AuthSession } from './auth.models';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly state = signal<AuthSession | null>(null);
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
    this.state.set(session);
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
    void this.router.navigateByUrl('/login');
  }
}

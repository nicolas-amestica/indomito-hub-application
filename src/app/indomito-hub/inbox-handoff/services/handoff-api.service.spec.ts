import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthService } from '../../../core/auth/auth.service';
import { HandoffApiService } from './handoff-api.service';

describe('permisos HTTP de derivación', () => {
  const auth = { token: vi.fn(), logout: vi.fn() };
  let http: HttpTestingController;
  let api: HandoffApiService;
  beforeEach(() => {
    auth.token.mockReset();
    auth.logout.mockReset();
    auth.token.mockReturnValue('normal-hub-session');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(HandoffApiService);
  });
  afterEach(() => http.verify());
  it('envía el token únicamente en el cuerpo sin adjuntar el JWT de Hub', async () => {
    const response = api.redeem('opaque-link');
    const request = http.expectOne((req) => req.url.endsWith('/derivaciones/canjes'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token: 'opaque-link' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ data: { sessionToken: 'read-only', expiresAt: '2026-11-13T12:30:00Z' } });
    expect((await response).sessionToken).toBe('read-only');
    expect(auth.token).not.toHaveBeenCalled();
  });
  it('presenta la sesión temporal al authorizer y nunca en el cuerpo de lectura', async () => {
    const response = api.read('scoped-session', 'MSG#older');
    const request = http.expectOne((req) => req.url.endsWith('/derivaciones/lecturas'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer scoped-session');
    expect(request.request.body).toEqual({ before: 'MSG#older' });
    expect(auth.token).not.toHaveBeenCalled();
    request.flush({ data: { messages: [] } });
    await response;
  });

  it('el vencimiento del acceso temporal no cierra la sesión normal', async () => {
    const response = api.read('expired-session');
    const assertion = expect(response).rejects.toMatchObject({ kind: 'unavailable' });
    const request = http.expectOne((req) => req.url.endsWith('/derivaciones/lecturas'));
    request.flush({}, { status: 403, statusText: 'Forbidden' });
    await assertion;
    expect(auth.logout).not.toHaveBeenCalled();
  });
});

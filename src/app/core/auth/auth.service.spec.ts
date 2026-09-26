import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import type { AuthSession } from './auth.models';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'indomito.auth.session';

describe('AuthService', () => {
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

  beforeEach(() => {
    sessionStorage.clear();
    router.navigateByUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
  });

  it('conserva la sesión autenticada para restaurarla después de una recarga', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const session = authSession(jwtExpiringIn(3_600));

    const login = service.login('17137440-5', 'secret');
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({ data: session });
    await login;

    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)).toEqual(session);
    expect(service.authenticated()).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/cotizaciones');
  });

  it('navega al primer modulo LV2 legible y no al contenedor LV1', async () => {
    const service = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const session = authSession(jwtExpiringIn(3_600));
    session.permissions.unshift({
      module: {
        code: 'PRG', title: 'Programas', category: 'Programas', path: '/programas',
        icon: 'icon-[tabler--route]', order: 0, active: true, endpoints: [], level: 'LV1',
      },
      allowances: ['r'],
    });
    session.permissions[1].module.level = 'LV2';
    session.permissions[1].module.parentCode = 'PRG';
    session.permissions[1].module.path = '/cotizaciones';

    const login = service.login('17137440-5', 'secret');
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({ data: session });
    await login;

    expect(router.navigateByUrl).toHaveBeenCalledWith('/cotizaciones');
  });

  it('restaura una sesión almacenada cuyo JWT sigue vigente', () => {
    const session = authSession(jwtExpiringIn(3_600));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    const service = TestBed.inject(AuthService);

    expect(service.session()).toEqual(session);
    expect(service.canAccess('PROGRAMS')).toBe(true);
  });

  it('descarta una sesión alterada o expirada', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authSession(jwtExpiringIn(-1))));

    const service = TestBed.inject(AuthService);

    expect(service.authenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('oculta un LV2 aunque tenga lectura cuando su LV1 no tiene lectura', () => {
    const session = authSession(jwtExpiringIn(3_600));
    session.permissions.unshift({
      module: {
        code: 'PRG', title: 'Programas', category: 'Programas', path: '/programas',
        icon: 'icon-[tabler--route]', order: 1, active: true, endpoints: [], level: 'LV1',
      },
      allowances: [],
    });
    session.permissions[1].module.level = 'LV2';
    session.permissions[1].module.parentCode = 'PRG';
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    const service = TestBed.inject(AuthService);

    expect(service.canAccess('PROGRAMS')).toBe(false);
    expect(service.modules().map((module) => module.code)).not.toContain('PROGRAMS');
  });

  it('elimina la sesión almacenada al cerrar sesión', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authSession(jwtExpiringIn(3_600))));
    const service = TestBed.inject(AuthService);

    service.logout();

    expect(service.authenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});

function authSession(token: string): AuthSession {
  return {
    token,
    expiresIn: 3_600,
    user: {
      id: 'user-1',
      name: 'Usuario DEV',
      email: 'usuario@example.com',
      rut: '17137440-5',
      profileCode: 'ADM',
      active: true,
    },
    permissions: [
      {
        module: {
          code: 'PROGRAMS',
          title: 'Programas',
          category: 'Programas',
          path: '/cotizaciones',
          icon: 'icon-[tabler--file]',
          order: 1,
          active: true,
          endpoints: ['/cotizaciones'],
        },
        allowances: ['r', 'w'],
      },
    ],
  };
}

function jwtExpiringIn(seconds: number): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=/gu, '').replace(/\+/gu, '-').replace(/\//gu, '_');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    exp: Math.floor(Date.now() / 1000) + seconds,
  })}.signature`;
}

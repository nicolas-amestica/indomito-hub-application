import { Routes } from '@angular/router';
import { authGuard, moduleGuard } from './core/auth/auth.guard';
export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () =>
      import('./indomito-hub/authentication/authentication.routes').then(
        (m) => m.AUTHENTICATION_ROUTES,
      ),
  },
  {
    path: 'recuperar-clave',
    loadComponent: () =>
      import('./indomito-hub/authentication/pages/request-password-reset/request-password-reset.page').then(
        (m) => m.RequestPasswordResetPage,
      ),
  },
  {
    path: 'restablecer-clave',
    loadComponent: () =>
      import('./indomito-hub/authentication/pages/reset-password/reset-password.page').then(
        (m) => m.ResetPasswordPage,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'inicio',
        loadChildren: () =>
          import('./indomito-hub/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'cobranza',
        loadChildren: () =>
          import('./indomito-hub/collections/collections.routes').then((m) => m.COLLECTIONS_ROUTES),
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'cotizaciones',
        data: { module: 'PROGRAMS' },
        canActivate: [moduleGuard],
        loadChildren: () =>
          import('./indomito-hub/programs/programs.routes').then((m) => m.PROGRAMS_ROUTES),
      },
      {
        path: 'contratos',
        loadChildren: () =>
          import('./indomito-hub/contracts/contracts.routes').then((m) => m.CONTRACTS_ROUTES),
      },
      {
        path: '',
        loadChildren: () =>
          import('./indomito-hub/administration/administration.routes').then(
            (m) => m.ADMINISTRATION_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

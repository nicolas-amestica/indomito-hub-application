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
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'programas',
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
      { path: '', pathMatch: 'full', redirectTo: 'programas' },
    ],
  },
  { path: '**', redirectTo: '' },
];

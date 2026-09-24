import { Routes } from '@angular/router';
import { authGuard, moduleGuard } from './core/auth/auth.guard';
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
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
          import('./features/programas/programas.routes').then((m) => m.PROGRAMAS_ROUTES),
      },
      {
        path: 'iam',
        data: { module: 'IAM' },
        canActivate: [moduleGuard],
        loadComponent: () => import('./features/iam/iam.page').then((m) => m.IamPage),
      },
      {
        path: 'configuracion',
        data: { module: 'CONFIGURATION' },
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/configuration/configuration.page').then((m) => m.ConfigurationPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'programas' },
    ],
  },
  { path: '**', redirectTo: '' },
];

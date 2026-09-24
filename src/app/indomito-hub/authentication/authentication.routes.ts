import { Routes } from '@angular/router';

export const AUTHENTICATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
];

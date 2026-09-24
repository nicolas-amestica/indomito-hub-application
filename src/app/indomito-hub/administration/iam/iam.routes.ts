import { Routes } from '@angular/router';

export const IAM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/iam-admin/iam-admin.page').then((m) => m.IamAdminPage),
  },
];

import type { Routes } from '@angular/router';
import { moduleGuard } from '../../core/auth/auth.guard';

export const CONTRACTS_ROUTES: Routes = [
  {
    path: 'nuevo',
    title: 'Crear contrato',
    data: { module: 'CONTRACT_CREATE' },
    canActivate: [moduleGuard],
    loadComponent: () => import('./pages/contract-form/contract-form.page').then((m) => m.ContractFormPage),
  },
  {
    path: ':id/editar',
    title: 'Editar contrato',
    data: { module: 'CONTRACT_CREATE' },
    canActivate: [moduleGuard],
    loadComponent: () => import('./pages/contract-form/contract-form.page').then((m) => m.ContractFormPage),
  },
  {
    path: '',
    title: 'Listado de contratos',
    data: { module: 'CONTRACT_LIST' },
    canActivate: [moduleGuard],
    loadComponent: () => import('./pages/contract-list/contract-list.page').then((m) => m.ContractListPage),
  },
];

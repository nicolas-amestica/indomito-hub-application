import type { Routes } from '@angular/router';
import { moduleGuard } from '../../core/auth/auth.guard';
import type { BalanceDetailPage } from './pages/balance-detail.page';
/** Rutas protegidas por el módulo IAM autoritativo y salida con cambios pendientes. */
export const ANALYTICS_ROUTES: Routes = [
  {
    path: 'detalle-balance',
    title: 'Detalle balance',
    data: { module: 'ANALYTICS_BALANCE_DETAIL' },
    canActivate: [moduleGuard],
    canDeactivate: [(page: BalanceDetailPage) => page.canLeave()],
    loadComponent: () =>
      import('./pages/balance-detail.page').then((module) => module.BalanceDetailPage),
  },
];

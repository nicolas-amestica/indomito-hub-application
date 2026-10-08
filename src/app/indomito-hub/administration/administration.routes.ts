import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/auth/auth.guard';

export const ADMINISTRATION_ROUTES: Routes = [
  {
    path: 'administracion/catalogo-servicios',
    data: { module: 'SERVICE_CATALOG' },
    canActivate: [moduleGuard],
    loadChildren: () =>
      import('./service-catalog/service-catalog.routes').then((m) => m.SERVICE_CATALOG_ROUTES),
  },
  {
    path: 'iam',
    data: { module: 'IAM' },
    canActivate: [moduleGuard],
    loadChildren: () => import('./iam/iam.routes').then((m) => m.IAM_ROUTES),
  },
  {
    path: 'configuracion',
    data: { module: 'CONFIGURATION' },
    canActivate: [moduleGuard],
    loadChildren: () =>
      import('./configuration/configuration.routes').then((m) => m.CONFIGURATION_ROUTES),
  },
];

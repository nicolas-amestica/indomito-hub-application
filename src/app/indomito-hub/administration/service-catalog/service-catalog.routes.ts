import { Routes } from '@angular/router';

export const SERVICE_CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/service-catalog/service-catalog.page').then(
        (component) => component.ServiceCatalogPage,
      ),
  },
];

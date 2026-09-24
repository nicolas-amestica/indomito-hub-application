import { Routes } from '@angular/router';

export const CONFIGURATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/configuration/configuration.page').then((m) => m.ConfigurationPage),
  },
];

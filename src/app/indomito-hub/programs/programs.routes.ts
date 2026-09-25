import { Routes } from '@angular/router';

/**
 * Rutas de la feature de programas.
 *
 * El formulario es hoy la única vista de la feature, porque la persistencia del
 * programa está fuera del alcance de esta spec: no hay listado ni edición que
 * enrutar. La ruta vacía redirige a `nuevo` en vez de alojar el formulario
 * directamente, para que `/programas` siga siendo un destino válido cuando el
 * listado exista y ocupe ese lugar.
 */
export const PROGRAMS_ROUTES: Routes = [
  {
    path: 'nuevo',
    title: 'Cotización',
    loadComponent: () =>
      import('./pages/program-form/program-form.page').then((m) => m.ProgramFormPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'nuevo' },
];

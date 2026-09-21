import { Routes } from '@angular/router';

/**
 * Rutas raíz de la aplicación.
 *
 * Cada feature entra por una sola ruta y se carga de forma diferida con
 * `loadChildren`, para que el chunk inicial contenga únicamente el armazón. El
 * presupuesto de bundle inicial del proyecto es de 500 kB de advertencia y
 * 1 MB de error, así que la carga diferida no es una optimización opcional.
 */
export const routes: Routes = [
  {
    path: 'programas',
    loadChildren: () => import('./features/programas/programas.routes').then((m) => m.PROGRAMAS_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'programas' },
  { path: '**', redirectTo: 'programas' },
];

import type { Routes } from '@angular/router';

export const INBOX_HANDOFF_ROUTES: Routes = [
  {
    path: ':phone',
    title: 'Conversación derivada | Indómito Hub',
    loadComponent: () => import('./pages/handoff.page').then((m) => m.HandoffPageComponent),
  },
];

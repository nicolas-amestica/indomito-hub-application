import { Routes } from '@angular/router';

export const INBOX_ROUTES: Routes = [
  {
    path: '',
    title: 'Conversaciones',
    loadComponent: () =>
      import('./pages/inbox-shell/inbox-shell.page').then((module) => module.InboxShellPage),
  },
];

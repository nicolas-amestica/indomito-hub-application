import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
export const authGuard: CanActivateFn = () => {
  const a = inject(AuthService);
  return a.authenticated() || inject(Router).createUrlTree(['/login']);
};
export const moduleGuard: CanActivateFn = (route) => {
  const a = inject(AuthService);
  if (a.canAccess(String(route.data['module']))) return true;
  const fallback = a.modules().find((module) => module.level === 'LV2') ?? a.modules()[0];
  return inject(Router).createUrlTree([fallback?.path || '/login']);
};

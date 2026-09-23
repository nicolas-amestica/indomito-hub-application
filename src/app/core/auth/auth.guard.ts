import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
export const authGuard: CanActivateFn = () => {
  const a = inject(AuthService);
  return a.authenticated() || inject(Router).createUrlTree(['/login']);
};
export const moduleGuard: CanActivateFn = (route) => {
  const a = inject(AuthService);
  return a.canAccess(String(route.data['module'])) || inject(Router).createUrlTree(['/programas']);
};

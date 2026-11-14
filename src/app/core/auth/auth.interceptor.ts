import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SKIP_SESSION_AUTH } from '../http/request-context';
import { AuthService } from './auth.service';
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_SESSION_AUTH)) return next(req);
  const auth = inject(AuthService);
  const token = auth.token();
  const secured = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(secured).pipe(
    catchError((error) => {
      if (error.status === 401 && token) auth.logout();
      return throwError(() => error);
    }),
  );
};

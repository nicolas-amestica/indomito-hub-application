import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, firstValueFrom, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SILENT_HTTP_ERRORS, SKIP_SESSION_AUTH } from '../../../core/http/request-context';
import { handoffRequestError } from '../fn/handoff-request-error';
import type { HandoffPage, HandoffSession } from '../interfaces/handoff.interface';

/** Usa permisos propios y nunca los propaga a endpoints normales de Hub. */
@Injectable({ providedIn: 'root' })
export class HandoffApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/derivaciones`;

  redeem(token: string): Promise<HandoffSession> {
    return this.post<HandoffSession>('canjes', { token });
  }
  read(sessionToken: string, before?: string): Promise<HandoffPage> {
    return this.post<HandoffPage>('lecturas', { before: before ?? '' }, sessionToken);
  }
  private post<T>(path: string, body: object, sessionToken?: string): Promise<T> {
    const context = new HttpContext().set(SKIP_SESSION_AUTH, true).set(SILENT_HTTP_ERRORS, true);
    return firstValueFrom(
      this.http
        .post<{ data: T }>(`${this.base}/${path}`, body, {
          context,
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
          timeout: 15000,
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        })
        .pipe(
          map(({ data }) => data),
          catchError((error) => throwError(() => handoffRequestError(error))),
        ),
    );
  }
}

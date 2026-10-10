import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CollectionAccount,
  AccountOperationRequest,
} from '../interfaces/collection-account.interface';
import type { AccountAttemptPage } from '../interfaces/attempt-reconciliation.interface';

@Injectable({ providedIn: 'root' })
export class CollectionAccounts {
  private readonly http = inject(HttpClient);
  get(id: string) {
    return this.http.get<{ data: CollectionAccount }>(this.url(id)).pipe(map(({ data }) => data));
  }
  apply(id: string, request: AccountOperationRequest) {
    return this.http
      .post<{ data: { account: CollectionAccount } }>(this.url(id) + '/operaciones', request)
      .pipe(map(({ data }) => data.account));
  }
  attempts(id: string, cursor = '') {
    return this.http
      .get<{ data: AccountAttemptPage }>(this.url(id) + '/intentos', {
        params: cursor ? { cursor } : {},
      })
      .pipe(map(({ data }) => data));
  }
  private url(id: string): string {
    return `${environment.apiUrl}/pagos/cuentas/${encodeURIComponent(id)}`;
  }
}

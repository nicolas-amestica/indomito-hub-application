import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type { GroupDepositRequest, GroupDepositState } from '../interfaces/group-deposit.interface';

@Injectable({ providedIn: 'root' })
export class CollectionGroupDeposits {
  private readonly http = inject(HttpClient);

  create(tripId: string, request: GroupDepositRequest) {
    return this.http
      .post<ApiSuccessEnvelope<GroupDepositState>>(this.url(tripId), request)
      .pipe(map(({ data }) => data));
  }

  get(tripId: string, commandId: string) {
    return this.http
      .get<ApiSuccessEnvelope<GroupDepositState>>(
        `${this.url(tripId)}/${encodeURIComponent(commandId)}`,
      )
      .pipe(map(({ data }) => data));
  }

  private url(tripId: string): string {
    return `${environment.apiUrl}/pagos/giras/${encodeURIComponent(tripId)}/abonos-grupales`;
  }
}

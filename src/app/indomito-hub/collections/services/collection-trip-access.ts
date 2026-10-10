import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type { TripAccessRequest, TripAccessView } from '../interfaces/trip-access.interface';
@Injectable({ providedIn: 'root' })
export class CollectionTripAccess {
  private readonly http = inject(HttpClient);
  get(tripId: string) {
    return this.http
      .get<ApiSuccessEnvelope<TripAccessView>>(this.url(tripId))
      .pipe(map(({ data }) => data));
  }
  change(tripId: string, action: 'rotate' | 'revoke', request: TripAccessRequest) {
    return this.http
      .post<ApiSuccessEnvelope<TripAccessView>>(`${this.url(tripId)}/${action}`, request)
      .pipe(map(({ data }) => data));
  }
  private url(tripId: string) {
    return `${environment.apiUrl}/pagos/giras/${encodeURIComponent(tripId)}/acceso`;
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  ReceiptFailure,
  ReceiptFailurePage,
  ReceiptFailureRetryRequest,
} from '../interfaces/receipt-failure.interface';

@Injectable({ providedIn: 'root' })
export class CollectionReceiptFailures {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pagos/comprobantes/fallos`;
  list(date: string, cursor = '') {
    let params = new HttpParams().set('date', date);
    if (cursor) params = params.set('cursor', cursor);
    return this.http
      .get<ApiSuccessEnvelope<ReceiptFailurePage>>(this.url, { params })
      .pipe(map(({ data }) => data));
  }
  retry(receiptId: string, request: ReceiptFailureRetryRequest) {
    return this.http
      .post<ApiSuccessEnvelope<ReceiptFailure>>(
        `${this.url}/${encodeURIComponent(receiptId)}/reintentos`,
        request,
      )
      .pipe(map(({ data }) => data));
  }
}

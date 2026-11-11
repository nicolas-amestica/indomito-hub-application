import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  ReceivedTaxPage,
  ReceivedTaxResponse,
  ReceivedSyncAccepted,
  ReceivedSyncRequest,
} from '../interfaces/received-tax-document.interface';

@Injectable({ providedIn: 'root' })
export class ReceivedTaxDocuments {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pagos/documentos-tributarios/recibidos`;

  synchronize() {
    return this.http
      .post<ApiSuccessEnvelope<ReceivedSyncAccepted>>(`${this.url}/sincronizaciones`, {})
      .pipe(map(({ data }) => data));
  }

  syncStatus(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<{ request: ReceivedSyncRequest }>>(
        `${this.url}/sincronizaciones/${encodeURIComponent(id)}`,
      )
      .pipe(map(({ data }) => data.request));
  }

  list(month: string, cursor = '') {
    const params = new HttpParams().set('month', month).set('cursor', cursor);
    return this.http
      .get<ApiSuccessEnvelope<ReceivedTaxPage>>(this.url, { params })
      .pipe(map(({ data }) => data));
  }

  events(id: string, month: string, action = '', commandId = '', reason = '') {
    return this.http
      .post<ApiSuccessEnvelope<ReceivedTaxResponse>>(
        `${this.url}/${id}/eventos`,
        { action, commandId, reason, confirmed: !!action },
        { params: { month } },
      )
      .pipe(map(({ data }) => data));
  }

  download(id: string, month: string) {
    return this.http
      .get<ApiSuccessEnvelope<{ url: string }>>(`${this.url}/${id}/descarga`, { params: { month } })
      .pipe(map(({ data }) => data));
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  ManualTaxIssuanceRequest,
  CreateTaxDocumentRequest,
  TaxDocumentListStatus,
  TaxDocumentPage,
  TaxDocumentRequest,
} from '../interfaces/tax-document.interface';

@Injectable({ providedIn: 'root' })
export class CollectionTaxDocuments {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/pagos/documentos-tributarios`;

  list(status: TaxDocumentListStatus, cursor = '') {
    let params = new HttpParams().set('status', status);
    if (cursor) params = params.set('cursor', cursor);
    return this.http
      .get<ApiSuccessEnvelope<TaxDocumentPage>>(`${this.url}/pendientes`, { params })
      .pipe(map(({ data }) => data));
  }

  listAll() {
    return forkJoin([this.list('PENDING'), this.list('RECORDED')]).pipe(
      map(([pending, recorded]) => ({
        items: [...pending.items, ...recorded.items].sort((left, right) =>
          right.requestedAt.localeCompare(left.requestedAt),
        ),
      })),
    );
  }

  recordManual(requestId: string, request: ManualTaxIssuanceRequest) {
    return this.http
      .post<ApiSuccessEnvelope<TaxDocumentRequest>>(
        `${this.url}/${encodeURIComponent(requestId)}/emision-manual`,
        request,
      )
      .pipe(map(({ data }) => data));
  }

  create(request: CreateTaxDocumentRequest) {
    return this.http
      .post<ApiSuccessEnvelope<TaxDocumentRequest>>(`${this.url}/emisiones`, request)
      .pipe(map(({ data }) => data));
  }

  issue(requestId: string) {
    return this.http
      .post<ApiSuccessEnvelope<TaxDocumentRequest>>(
        `${this.url}/${encodeURIComponent(requestId)}/emision`,
        {},
      )
      .pipe(map(({ data }) => data));
  }

  download(requestId: string) {
    return this.http
      .get<ApiSuccessEnvelope<{ url: string; expiresIn: number }>>(
        `${this.url}/${encodeURIComponent(requestId)}/descarga`,
      )
      .pipe(map(({ data }) => data));
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  ServiceCatalogInput,
  ServiceCatalogItem,
  ServiceCatalogList,
} from '../interfaces/service-catalog.interface';

@Injectable({ providedIn: 'root' })
export class ServiceCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/catalogo:servicios`;

  list(includeInactive = false): Observable<ServiceCatalogItem[]> {
    let params = new HttpParams().set('scope', 'CTZ');
    if (includeInactive) params = params.set('includeInactive', 'true');
    return this.http
      .get<ApiSuccessEnvelope<ServiceCatalogList>>(this.url, { params })
      .pipe(map(({ data }) => data.items));
  }

  create(input: ServiceCatalogInput): Observable<ServiceCatalogItem> {
    return this.http
      .post<ApiSuccessEnvelope<ServiceCatalogItem>>(this.url, input, {
        params: new HttpParams().set('scope', 'CTZ'),
      })
      .pipe(map(({ data }) => data));
  }

  update(id: string, input: ServiceCatalogInput): Observable<ServiceCatalogItem> {
    return this.http
      .put<ApiSuccessEnvelope<ServiceCatalogItem>>(`${this.url}/${id}`, input, {
        params: new HttpParams().set('scope', 'CTZ'),
      })
      .pipe(map(({ data }) => data));
  }
}

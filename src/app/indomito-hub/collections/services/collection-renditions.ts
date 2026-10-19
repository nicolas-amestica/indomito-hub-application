import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  CollectionRendition,
  CollectionRenditionItem,
  CollectionRenditionPage,
} from '../interfaces/collection-rendition.interface';

@Injectable({ providedIn: 'root' })
export class CollectionRenditions {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/pagos/tesoreria/rendiciones`;

  /** Consulta rendiciones por mes UTC de recepción. */
  list(month: string, cursor = '') {
    const params = new HttpParams().set('month', month).set('cursor', cursor);
    return this.http
      .get<ApiSuccessEnvelope<CollectionRenditionPage<CollectionRendition>>>(this.base, { params })
      .pipe(map(({ data }) => data));
  }

  /** Consulta resultados de un lote sin modificar su estado financiero. */
  detail(id: string, cursor = '') {
    const params = new HttpParams().set('cursor', cursor);
    return this.http
      .get<ApiSuccessEnvelope<CollectionRenditionPage<CollectionRenditionItem>>>(
        `${this.base}/${encodeURIComponent(id)}`,
        { params },
      )
      .pipe(map(({ data }) => data));
  }
}

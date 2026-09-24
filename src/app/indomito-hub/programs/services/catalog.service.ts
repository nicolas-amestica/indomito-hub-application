import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import { environment } from '../../../../environments/environment';
import type { CatalogResponse } from '../interfaces/catalog.interface';

/** Acceso HTTP al contrato consolidado de catálogos del programa. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  /** Obtiene planes, temporadas, destinos y parámetros de empresa en una llamada. */
  getCatalogs(): Observable<CatalogResponse> {
    return this.http
      .get<ApiSuccessEnvelope<CatalogResponse>>(`${environment.apiUrl}/catalogos`)
      .pipe(map((response) => response.data));
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  Favorite,
  FavoriteScope,
  FavoriteUpsertRequest,
} from '../interfaces/favorite.interface';

/** Acceso HTTP al CRUD protegido de favoritos. */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/cotizaciones`;

  /** Lista la colección del usuario autenticado para el scope indicado. */
  list(scope: FavoriteScope): Observable<Favorite[]> {
    const params = new HttpParams().set('scope', scope);
    return this.http
      .get<ApiSuccessEnvelope<Favorite[]>>(this.endpoint, { params })
      .pipe(map(({ data }) => data));
  }

  /** Crea un favorito de programa. */
  create(request: FavoriteUpsertRequest): Observable<Favorite> {
    return this.http
      .post<ApiSuccessEnvelope<Favorite>>(this.endpoint, request)
      .pipe(map(({ data }) => data));
  }

  /** Reemplaza el nombre y contenido de un favorito existente. */
  update(id: string, request: FavoriteUpsertRequest): Observable<Favorite> {
    return this.http
      .put<ApiSuccessEnvelope<Favorite>>(`${this.endpoint}/${encodeURIComponent(id)}`, request)
      .pipe(map(({ data }) => data));
  }

  /** Elimina un favorito perteneciente al usuario autenticado. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${encodeURIComponent(id)}`);
  }
}

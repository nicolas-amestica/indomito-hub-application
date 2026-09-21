import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import { environment } from '../../../../environments/environment';
import type { ExchangeSnapshot } from '../interfaces/program.interface';

/** Acceso HTTP al snapshot vigente de tipos de cambio. */
@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private readonly http = inject(HttpClient);

  /** Obtiene las tasas que deben usarse durante la sesión del formulario. */
  getSnapshot(): Observable<ExchangeSnapshot> {
    return this.http
      .get<ApiSuccessEnvelope<ExchangeSnapshot>>(`${environment.apiUrl}/tasas-cambio`)
      .pipe(map((response) => response.data));
  }
}

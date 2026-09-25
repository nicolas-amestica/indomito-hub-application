import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type { ProgramFormConfiguration } from '../interfaces/program-form-configuration.interface';

/** Obtiene la configuración dinámica del formulario Crear Programa. */
@Injectable({ providedIn: 'root' })
export class ProgramFormConfigurationService {
  private readonly http = inject(HttpClient);

  get(): Observable<ProgramFormConfiguration> {
    return this.http
      .get<ApiSuccessEnvelope<ProgramFormConfiguration>>(
        `${environment.apiUrl}/contratos:configuracion`,
        { params: new HttpParams().set('scope', 'PGR') },
      )
      .pipe(map(({ data }) => data));
  }
}

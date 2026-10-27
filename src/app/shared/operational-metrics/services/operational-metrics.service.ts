import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type { OperationalMetrics } from '../interfaces/operational-metrics.interface';

@Injectable({ providedIn: 'root' })
export class OperationalMetricsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion-agente/metricas`;

  get() {
    return this.http.get<ApiSuccessEnvelope<OperationalMetrics>>(this.url).pipe(
      map(({ data }) => ({
        ...data,
        aws: {
          ...data.aws,
          freeTier: Array.isArray(data.aws.freeTier) ? data.aws.freeTier : [],
        },
      })),
    );
  }
}

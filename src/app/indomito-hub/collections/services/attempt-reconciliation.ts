import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  AttemptReconciliationRequest,
  AttemptReconciliationState,
} from '../interfaces/attempt-reconciliation.interface';
@Injectable({ providedIn: 'root' })
export class AttemptReconciliation {
  private readonly http = inject(HttpClient);
  reconcile(id: string, request: AttemptReconciliationRequest) {
    return this.http
      .post<ApiSuccessEnvelope<AttemptReconciliationState>>(
        `${environment.apiUrl}/pagos/intentos/${encodeURIComponent(id)}/conciliacion`,
        request,
      )
      .pipe(map(({ data }) => data));
  }
}

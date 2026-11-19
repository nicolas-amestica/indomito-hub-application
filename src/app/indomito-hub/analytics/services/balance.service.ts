import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  BalanceCommand,
  BalanceDetail,
  BalancePage,
  BalanceState,
} from '../interfaces/balance.interface';

/** IO del módulo: usa autenticación, errores y envelope compartidos. */
@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/analitica/giras`;
  list(year: number, from: string, to: string, cursor = '') {
    const params = new HttpParams()
      .set('year', year)
      .set('from', from)
      .set('to', to)
      .set('cursor', cursor);
    return this.http
      .get<ApiSuccessEnvelope<BalancePage>>(this.base, { params })
      .pipe(map(({ data }) => data));
  }
  detail(id: string, from: string, to: string, version?: number) {
    let params = new HttpParams().set('from', from).set('to', to);
    if (version) params = params.set('version', version);
    return this.http
      .get<ApiSuccessEnvelope<BalanceDetail>>(`${this.base}/${encodeURIComponent(id)}`, { params })
      .pipe(map(({ data }) => data));
  }
  save(id: string, command: BalanceCommand) {
    return this.http
      .put<ApiSuccessEnvelope<BalanceState>>(
        `${this.base}/${encodeURIComponent(id)}/presupuesto`,
        command,
      )
      .pipe(map(({ data }) => data));
  }
}

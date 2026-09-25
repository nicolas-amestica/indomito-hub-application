import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  Contract,
  ContractContent,
  ContractCreateRequest,
  ContractFormConfiguration,
  ContractPDFAccess,
  ContractUpdateRequest,
} from '../interfaces/contract.interface';

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/contratos`;
  create(request: ContractCreateRequest): Observable<Contract> {
    return this.http
      .post<ApiSuccessEnvelope<Contract>>(this.endpoint, request)
      .pipe(map(({ data }) => data));
  }
  get(id: string): Observable<Contract> {
    return this.http
      .get<ApiSuccessEnvelope<Contract>>(`${this.endpoint}/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }
  list(year: number): Observable<Contract[]> {
    return this.http
      .get<ApiSuccessEnvelope<Contract[]>>(this.endpoint, {
        params: new HttpParams().set('year', String(year)),
      })
      .pipe(map(({ data }) => data));
  }
  getConfiguration(scope = 'CTX'): Observable<ContractFormConfiguration> {
    return this.http
      .get<ApiSuccessEnvelope<ContractFormConfiguration>>(`${this.endpoint}:configuracion`, {
        params: new HttpParams().set('scope', scope),
      })
      .pipe(map(({ data }) => data));
  }
  update(id: string, request: ContractUpdateRequest): Observable<Contract> {
    return this.http
      .put<ApiSuccessEnvelope<Contract>>(`${this.endpoint}/${encodeURIComponent(id)}`, request)
      .pipe(map(({ data }) => data));
  }
  generatePdf(content: ContractContent, preview = true): Observable<Blob> {
    return this.http.post(`${this.endpoint}:pdf`, { content, preview }, { responseType: 'blob' });
  }
  getApprovedPdf(id: string): Observable<ContractPDFAccess> {
    return this.http
      .get<ApiSuccessEnvelope<ContractPDFAccess>>(`${this.endpoint}/${encodeURIComponent(id)}/pdf`)
      .pipe(map(({ data }) => data));
  }
}

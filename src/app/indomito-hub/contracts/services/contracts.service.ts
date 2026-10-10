import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { from, map, switchMap, throwError, type Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  Contract,
  ContractAmendment,
  ContractAmendmentCreateRequest,
  ContractAmendmentPage,
  ContractContent,
  ContractCreateRequest,
  ContractFormConfiguration,
  ContractPDFAccess,
  ContractSummary,
  ContractSignedDocument,
  ContractSignedDocumentPage,
  ContractSignedUploadPreparation,
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
  list(year: number): Observable<ContractSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<ContractSummary[]>>(this.endpoint, {
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
  prepareSignedDocument(
    id: string,
    request: {
      clientRequestId: string;
      size: number;
      sha256: string;
      currentDocumentId: string;
      replacementReason: string;
      confirmsAllSignatures: boolean;
    },
  ): Observable<ContractSignedUploadPreparation> {
    return this.http
      .post<ApiSuccessEnvelope<ContractSignedUploadPreparation>>(
        `${this.endpoint}/${encodeURIComponent(id)}/documentos-firmados:carga`,
        request,
      )
      .pipe(map(({ data }) => data));
  }
  uploadSignedDocument(uploadUrl: string, file: File): Observable<void> {
    return from(
      fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      }),
    ).pipe(
      switchMap((response) =>
        response.ok
          ? from(Promise.resolve())
          : throwError(() => new Error('No se pudo transferir el PDF firmado.')),
      ),
    );
  }
  finalizeSignedDocument(id: string, clientRequestId: string): Observable<ContractSignedDocument> {
    return this.http
      .post<ApiSuccessEnvelope<ContractSignedDocument>>(
        `${this.endpoint}/${encodeURIComponent(id)}/documentos-firmados:confirmar`,
        { clientRequestId },
      )
      .pipe(map(({ data }) => data));
  }
  listSignedDocuments(id: string, cursor = ''): Observable<ContractSignedDocumentPage> {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<ContractSignedDocumentPage>>(
        `${this.endpoint}/${encodeURIComponent(id)}/documentos-firmados`,
        { params },
      )
      .pipe(map(({ data }) => data));
  }
  getSignedDocumentPdf(id: string, documentId?: string): Observable<ContractPDFAccess> {
    const path = documentId
      ? `${this.endpoint}/${encodeURIComponent(id)}/documentos-firmados/${encodeURIComponent(documentId)}/pdf`
      : `${this.endpoint}/${encodeURIComponent(id)}/documento-firmado/pdf`;
    return this.http.get<ApiSuccessEnvelope<ContractPDFAccess>>(path).pipe(map(({ data }) => data));
  }
  createAmendment(
    contractId: string,
    request: ContractAmendmentCreateRequest,
  ): Observable<ContractAmendment> {
    return this.http
      .post<ApiSuccessEnvelope<ContractAmendment>>(
        `${this.endpoint}/${encodeURIComponent(contractId)}/anexos`,
        request,
      )
      .pipe(map(({ data }) => data));
  }
  listAmendments(contractId: string, cursor = ''): Observable<ContractAmendmentPage> {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<ContractAmendmentPage>>(
        `${this.endpoint}/${encodeURIComponent(contractId)}/anexos`,
        { params },
      )
      .pipe(map(({ data }) => data));
  }
  approveAmendment(
    contractId: string,
    amendmentId: string,
    version: number,
  ): Observable<ContractAmendment> {
    return this.http
      .post<ApiSuccessEnvelope<ContractAmendment>>(
        `${this.endpoint}/${encodeURIComponent(contractId)}/anexos/${encodeURIComponent(amendmentId)}/aprobacion`,
        { version },
      )
      .pipe(map(({ data }) => data));
  }
  getApprovedAmendmentPdf(contractId: string, amendmentId: string): Observable<ContractPDFAccess> {
    return this.http
      .get<ApiSuccessEnvelope<ContractPDFAccess>>(
        `${this.endpoint}/${encodeURIComponent(contractId)}/anexos/${encodeURIComponent(amendmentId)}/pdf`,
      )
      .pipe(map(({ data }) => data));
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  CollectionSettlement,
  CollectionAlertView,
  GlobalCollectionAlertView,
  OperationRecovery,
  ConsolidatedCashView,
  ReconcileSettlementRequest,
  RefundPage,
  SettlementPage,
  SupplierOperationRequest,
  SupplierPage,
  TripCashView,
} from '../interfaces/collection-treasury.interface';

@Injectable({ providedIn: 'root' })
export class CollectionTreasury {
  private readonly http = inject(HttpClient);

  listSettlements(tripId: string, cursor = '') {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<SettlementPage>>(`${this.base(tripId)}/liquidaciones`, { params })
      .pipe(map(({ data }) => data));
  }

  reconcile(tripId: string, paymentReference: string, request: ReconcileSettlementRequest) {
    const paymentId = paymentReference.replace(/^khipu:/, '');
    return this.http
      .post<ApiSuccessEnvelope<{ settlement: CollectionSettlement }>>(
        `${this.base(tripId)}/liquidaciones/${encodeURIComponent(paymentId)}`,
        request,
      )
      .pipe(map(({ data }) => data.settlement));
  }

  getCash(tripId: string, from: string, to: string) {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ApiSuccessEnvelope<TripCashView>>(`${this.base(tripId)}/caja`, { params })
      .pipe(map(({ data }) => data));
  }

  getConsolidatedCash(from: string, to: string) {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ApiSuccessEnvelope<ConsolidatedCashView>>(`${environment.apiUrl}/pagos/tesoreria/caja`, {
        params,
      })
      .pipe(map(({ data }) => data));
  }

  listSuppliers(tripId: string, cursor = '') {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<SupplierPage>>(`${this.base(tripId)}/proveedores`, { params })
      .pipe(map(({ data }) => data));
  }

  operateSupplier(tripId: string, supplierId: string, request: SupplierOperationRequest) {
    return this.http
      .post<
        ApiSuccessEnvelope<{
          supplier: import('../interfaces/collection-treasury.interface').SupplierCommitment;
        }>
      >(`${this.base(tripId)}/proveedores/${encodeURIComponent(supplierId)}`, request)
      .pipe(map(({ data }) => data.supplier));
  }

  listRefunds(tripId: string, cursor = '') {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<RefundPage>>(`${this.base(tripId)}/devoluciones`, { params })
      .pipe(map(({ data }) => data));
  }

  getAlerts(tripId: string, asOf: string) {
    const params = new HttpParams().set('asOf', asOf);
    return this.http
      .get<ApiSuccessEnvelope<CollectionAlertView>>(`${this.base(tripId)}/alertas`, { params })
      .pipe(map(({ data }) => data));
  }

  getGlobalAlerts(year: number, asOf: string) {
    const params = new HttpParams().set('year', String(year)).set('asOf', asOf);
    return this.http
      .get<ApiSuccessEnvelope<GlobalCollectionAlertView>>(
        `${environment.apiUrl}/pagos/tesoreria/alertas`,
        { params },
      )
      .pipe(map(({ data }) => data));
  }

  recoverOperation(
    commandId: string,
    kind: OperationRecovery['kind'],
    entityId: string,
    tripId = '',
  ) {
    let params = new HttpParams().set('kind', kind).set('entityId', entityId);
    if (tripId) params = params.set('tripId', tripId);
    return this.http
      .get<ApiSuccessEnvelope<OperationRecovery>>(
        `${environment.apiUrl}/pagos/operaciones/${encodeURIComponent(commandId)}`,
        { params },
      )
      .pipe(map(({ data }) => data));
  }

  private base(tripId: string): string {
    return `${environment.apiUrl}/pagos/tesoreria/giras/${encodeURIComponent(tripId)}`;
  }
}

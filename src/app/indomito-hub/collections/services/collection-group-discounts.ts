import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  GroupDiscountApprovalRequest,
  GroupDiscountDraftRequest,
  GroupDiscountState,
} from '../interfaces/group-discount.interface';

@Injectable({ providedIn: 'root' })
export class CollectionGroupDiscounts {
  private readonly http = inject(HttpClient);
  create(tripId: string, request: GroupDiscountDraftRequest) {
    return this.http
      .post<ApiSuccessEnvelope<GroupDiscountState>>(this.base(tripId), request)
      .pipe(map(({ data }) => data));
  }
  get(tripId: string, id: string) {
    return this.http
      .get<ApiSuccessEnvelope<GroupDiscountState>>(`${this.base(tripId)}/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }
  approve(tripId: string, id: string, request: GroupDiscountApprovalRequest) {
    return this.http
      .post<ApiSuccessEnvelope<GroupDiscountState>>(
        `${this.base(tripId)}/${encodeURIComponent(id)}/aprobacion`,
        request,
      )
      .pipe(map(({ data }) => data));
  }
  private base(tripId: string) {
    return `${environment.apiUrl}/pagos/giras/${encodeURIComponent(tripId)}/descuentos`;
  }
}

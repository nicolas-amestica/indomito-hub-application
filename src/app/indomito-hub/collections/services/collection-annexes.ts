import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccessEnvelope } from '../../../core/http/api-response.interface';
import type {
  AnnexDraftRequest,
  AnnexImpact,
  AnnexProposalPage,
  AnnexState,
  RosterPage,
  RosterMigrationState,
  RosterClosureState,
} from '../interfaces/collection-annex.interface';

@Injectable({ providedIn: 'root' })
export class CollectionAnnexes {
  private readonly http = inject(HttpClient);

  roster(tripId: string, cursor = '') {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<RosterPage>>(`${this.tripUrl(tripId)}/pasajeros`, { params })
      .pipe(map(({ data }) => data));
  }

  migrateRoster(tripId: string, commandId: string, reason: string) {
    return this.http
      .post<ApiSuccessEnvelope<RosterMigrationState>>(
        `${this.tripUrl(tripId)}/pasajeros/migracion`,
        { commandId, reason },
      )
      .pipe(map(({ data }) => data));
  }

  closeRoster(tripId: string, commandId: string, reason: string) {
    return this.http
      .post<ApiSuccessEnvelope<RosterClosureState>>(`${this.tripUrl(tripId)}/pasajeros/cierre`, {
        commandId,
        reason,
      })
      .pipe(map(({ data }) => data));
  }

  create(tripId: string, request: AnnexDraftRequest) {
    return this.http
      .post<ApiSuccessEnvelope<AnnexState>>(`${this.tripUrl(tripId)}/anexos`, request)
      .pipe(map(({ data }) => data));
  }

  get(tripId: string, annexId: string) {
    return this.http
      .get<ApiSuccessEnvelope<AnnexState>>(this.annexUrl(tripId, annexId))
      .pipe(map(({ data }) => data));
  }

  proposals(tripId: string, annexId: string, cursor = '') {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<AnnexProposalPage>>(`${this.annexUrl(tripId, annexId)}/propuestas`, {
        params,
      })
      .pipe(map(({ data }) => data));
  }

  impact(tripId: string, annexId: string) {
    return this.http
      .get<ApiSuccessEnvelope<AnnexImpact>>(`${this.annexUrl(tripId, annexId)}/impacto`)
      .pipe(map(({ data }) => data));
  }

  apply(tripId: string, annexId: string, commandId: string, reason: string) {
    return this.http
      .post<ApiSuccessEnvelope<AnnexState>>(`${this.annexUrl(tripId, annexId)}/aplicacion`, {
        commandId,
        reason,
      })
      .pipe(map(({ data }) => data));
  }

  private tripUrl(tripId: string): string {
    return `${environment.apiUrl}/pagos/giras/${encodeURIComponent(tripId)}`;
  }

  private annexUrl(tripId: string, annexId: string): string {
    return `${this.tripUrl(tripId)}/anexos/${encodeURIComponent(annexId)}`;
  }
}

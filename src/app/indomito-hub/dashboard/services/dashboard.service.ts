import { inject, Injectable } from '@angular/core';
import { forkJoin, type Observable } from 'rxjs';
import { ContractsService } from '../../contracts/services/contracts.service';
import { CollectionTreasury } from '../../collections/services/collection-treasury';
import type { DashboardView } from '../interfaces/dashboard.interface';

/** Compone las consultas anuales ya indexadas sin recorrer tablas DynamoDB. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly contracts = inject(ContractsService);
  private readonly treasury = inject(CollectionTreasury);

  load(year: number, from: string, to: string): Observable<DashboardView> {
    return forkJoin({
      contracts: this.contracts.list(year),
      cash: this.treasury.getConsolidatedCash(from, to),
      alerts: this.treasury.getGlobalAlerts(year, to),
    });
  }
}

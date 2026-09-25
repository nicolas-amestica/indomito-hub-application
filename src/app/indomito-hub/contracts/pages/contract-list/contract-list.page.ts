import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Select } from 'primeng/select';
import { ButtonDirective } from 'primeng/button';
import { Table } from 'primeng/table';
import { finalize } from 'rxjs';
import type { Contract, ContractStatus } from '../../interfaces/contract.interface';
import { ContractsService } from '../../services/contracts.service';
import { DocumentPreviewService } from '../../../../shared/documents/services/document-preview.service';

@Component({
  selector: 'app-contract-list-page',
  imports: [ButtonDirective, DatePipe, FormsModule, RouterLink, Select, Table],
  templateUrl: './contract-list.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractListPage {
  private readonly api = inject(ContractsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly documentPreview = inject(DocumentPreviewService);
  private readonly currentYear = new Date().getFullYear();
  protected readonly years = Array.from(
    { length: this.currentYear + 5 - 2025 + 1 },
    (_, index) => ({ label: String(2025 + index), value: 2025 + index }),
  );
  protected readonly selectedYear = signal(this.currentYear);
  protected readonly contracts = signal<Contract[]>([]);
  protected readonly loading = signal(false);

  constructor() {
    this.load(this.currentYear);
  }

  protected changeYear(year: number): void {
    this.selectedYear.set(year);
    this.load(year);
  }
  protected statusLabel(status: ContractStatus): string {
    return {
      DRAFT: 'Borrador',
      PENDING_APPROVAL: 'Pendiente de aprobación',
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
      CANCELLED: 'Cancelado',
    }[status];
  }
  protected statusClass(status: ContractStatus): string {
    return {
      DRAFT: 'bg-slate-100 text-slate-700',
      PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
      APPROVED: 'bg-emerald-100 text-emerald-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-zinc-200 text-zinc-700',
    }[status];
  }
  protected viewPdf(contract: Contract): void {
    this.loading.set(true);
    this.api
      .getApprovedPdf(contract.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe(({ url }) =>
        this.documentPreview.open({
          title: 'Contrato aprobado',
          description: `${contract.content.institution.name} · ${contract.content.trip.destination}`,
          documents: [
            { name: 'contrato-prestacion-servicios.pdf', mimeType: 'application/pdf', source: url },
          ],
        }),
      );
  }
  private load(year: number): void {
    this.loading.set(true);
    this.api
      .list(year)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (contracts) => this.contracts.set(contracts),
        error: () => this.contracts.set([]),
      });
  }
}

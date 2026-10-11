import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { finalize } from 'rxjs';
import { todayDateOnly } from '../../../../shared/date-only/date-only';
import type { DashboardView } from '../../interfaces/dashboard.interface';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    ButtonDirective,
    ChartModule,
    CurrencyPipe,
    FormsModule,
    Message,
    RouterLink,
    Select,
    Skeleton,
  ],
  templateUrl: './dashboard.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentYear = new Date().getFullYear();
  protected readonly years = Array.from({ length: 6 }, (_, index) => this.currentYear - 2 + index);
  protected readonly year = signal(this.currentYear);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly view = signal<DashboardView | null>(null);
  protected readonly approved = computed(
    () => this.view()?.contracts.filter(({ status }) => status === 'APPROVED').length ?? 0,
  );
  protected readonly passengers = computed(
    () => this.view()?.contracts.reduce((total, item) => total + item.passengerCount, 0) ?? 0,
  );
  protected readonly pendingSignatures = computed(
    () =>
      this.view()?.contracts.filter(
        ({ status, signatureStatus }) =>
          status === 'APPROVED' && signatureStatus !== 'SIGNED_UPLOADED',
      ).length ?? 0,
  );
  protected readonly upcomingTrips = computed(() => {
    const today = todayDateOnly();
    return [...(this.view()?.alerts.groups ?? [])]
      .filter(({ departureDate }) => Boolean(departureDate && departureDate >= today))
      .sort((left, right) => (left.departureDate ?? '').localeCompare(right.departureDate ?? ''))
      .slice(0, 5);
  });
  protected readonly statusChart = computed(() => {
    const contracts = this.view()?.contracts ?? [];
    const states = [
      ['Borradores', 'DRAFT'],
      ['Por aprobar', 'PENDING_APPROVAL'],
      ['Aprobados', 'APPROVED'],
      ['Rechazados', 'REJECTED'],
      ['Cancelados', 'CANCELLED'],
    ] as const;
    return {
      labels: states.map(([label]) => label),
      datasets: [
        {
          data: states.map(
            ([, state]) => contracts.filter(({ status }) => status === state).length,
          ),
          backgroundColor: ['#94a3b8', '#f59e0b', '#65a30d', '#ef4444', '#71717a'],
        },
      ],
    };
  });
  protected readonly cashChart = computed(() => ({
    labels: ['Entradas', 'Salidas', 'Comisiones', 'Vencido'],
    datasets: [
      {
        label: 'CLP',
        data: [
          this.view()?.cash.inflows ?? 0,
          this.view()?.cash.outflows ?? 0,
          this.view()?.cash.actualFees ?? 0,
          this.view()?.alerts.overdue ?? 0,
        ],
        backgroundColor: ['#65a30d', '#ef4444', '#f59e0b', '#7c3aed'],
      },
    ],
  }));
  protected readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
  };

  constructor() {
    this.load(this.currentYear);
  }

  protected changeYear(year: number): void {
    this.year.set(year);
    this.load(year);
  }

  protected load(year = this.year()): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const today = todayDateOnly();
    const to = year === this.currentYear ? today : `${year}-12-31`;
    this.api
      .load(year, `${year}-01-01`, to)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (view) => this.view.set(view),
        error: () => this.error.set('No fue posible cargar el resumen anual. Intenta nuevamente.'),
      });
  }
}

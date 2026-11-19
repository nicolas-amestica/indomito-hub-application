import {
  BALANCE_MESSAGE_TOKENS,
  BALANCE_TAG_TOKENS,
  BALANCE_EXPORT_TOKENS,
} from '../constants/balance-design-tokens';
import { DOCUMENT, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { Panel } from 'primeng/panel';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Table, SortableColumn, SortIcon } from 'primeng/table';
import { ProgressSpinner } from 'primeng/progressspinner';
import { AuthService } from '../../../core/auth/auth.service';
import { AppConfigurationService } from '../../../core/configuration/app-configuration.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { DateOnlyPickerComponent } from '../../../shared/date-only/date-only-picker.component';
import { isDateOnly, todayDateOnly } from '../../../shared/date-only/date-only';
import { BalanceChartComponent } from '../components/balance-chart.component';
import { BudgetEditorComponent } from '../components/budget-editor.component';
import {
  BALANCE_ACTION_LABELS,
  BALANCE_SOURCE_LABELS,
  BALANCE_SECTIONS,
} from '../constants/balance-options';
import { BALANCE_COLUMNS } from '../constants/balance-columns';
import { BalanceStore } from '../stores/balance.store';
import { buildBalanceCharts } from '../fn/build-balance-charts';
import { contractualSale, operatingBalance } from '../fn/operating-balance';
import { calculateBalance } from '../fn/calculate-balance';
import { balanceTableRow } from '../fn/balance-table';
import { createBudget, importContractBudget } from '../fn/create-budget';
import { fundingProjection, supplierMetrics, unbudgetedCommitments } from '../fn/financial-metrics';
import { exportBalance } from '../fn/export-balance';
import type { BalanceBudget, BalanceCommand } from '../interfaces/balance.interface';

/** Contenedor de filtros y acciones; las fórmulas, gráficos y editor son independientes. */
@Component({
  selector: 'app-balance-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    Button,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    InputNumber,
    Select,
    MultiSelect,
    Panel,
    Message,
    Tag,
    Table,
    SortableColumn,
    SortIcon,
    ProgressSpinner,
    PageHeaderComponent,
    DateOnlyPickerComponent,
    BalanceChartComponent,
    BudgetEditorComponent,
  ],
  providers: [BalanceStore, ConfirmationService],
  templateUrl: './balance-detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class BalanceDetailPage {
  readonly messageTokens = BALANCE_MESSAGE_TOKENS;
  readonly tagTokens = BALANCE_TAG_TOKENS;
  readonly exportTokens = BALANCE_EXPORT_TOKENS;
  readonly store = inject(BalanceStore);
  readonly auth = inject(AuthService);
  private readonly config = inject(AppConfigurationService);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);
  private readonly confirmation = inject(ConfirmationService);
  readonly today = todayDateOnly();
  readonly year = signal(Number(this.today.slice(0, 4)));
  readonly from = signal(`${this.today.slice(0, 4)}-01-01`);
  readonly to = signal(this.today);
  readonly search = signal('');
  readonly destination = signal<string | null>(null);
  readonly departureYear = signal<number | null>(null);
  readonly selectedTrips = signal<string[]>([]);
  readonly section = signal('summary');
  readonly reason = signal('');
  readonly localError = signal('');
  readonly scenarioId = signal('');
  readonly historical = signal(false);
  readonly exporting = signal(false);
  readonly actions = BALANCE_ACTION_LABELS;
  readonly sources = BALANCE_SOURCE_LABELS;
  readonly sections = BALANCE_SECTIONS;
  readonly columns = BALANCE_COLUMNS;
  readonly canEdit = computed(
    () => this.auth.canPerform('ANALYTICS_BALANCE_DETAIL', 'u') && !this.historical(),
  );
  readonly filtered = computed(() =>
    this.store.rows().filter((row) => {
      const q = this.search().trim().toLocaleLowerCase('es');
      const trip = row.trip;
      return (
        (!q ||
          `${trip.id} ${trip.institutionName} ${trip.content.institution.course}`
            .toLocaleLowerCase('es')
            .includes(q)) &&
        (!this.destination() || trip.destination === this.destination()) &&
        (!this.departureYear() ||
          trip.content.trip.departureDate?.startsWith(String(this.departureYear()))) &&
        (!this.selectedTrips().length || this.selectedTrips().includes(trip.id))
      );
    }),
  );
  readonly destinations = computed(() =>
    [...new Set(this.store.rows().map((row) => row.trip.destination))].sort(),
  );
  readonly tripOptions = computed(() =>
    this.store.rows().map((row) => ({
      label: `${row.trip.institutionName} · ${row.trip.destination}`,
      value: row.trip.id,
    })),
  );
  readonly tableRows = computed(() => this.filtered().map(balanceTableRow));
  readonly selected = computed(() => this.store.detail()?.row ?? null);
  readonly contractualSale = computed(() =>
    this.selected() ? contractualSale(this.selected()!) : null,
  );
  readonly operatingBalance = computed(() =>
    this.selected() ? operatingBalance(this.selected()!) : null,
  );
  readonly supplierSummary = computed(() =>
    this.selected()?.finance ? supplierMetrics(this.selected()!.finance!) : null,
  );
  readonly unbudgeted = computed(() =>
    this.store.draft() && this.selected()?.finance
      ? unbudgetedCommitments(this.store.draft()!, this.selected()!.finance!)
      : null,
  );
  readonly baseline = computed(() =>
    this.selected()?.state.baseline ? calculateBalance(this.selected()!.state.baseline!) : null,
  );
  readonly projection = computed(() =>
    this.store.draft()
      ? fundingProjection(
          this.store.draft()!,
          this.store.to() === this.store.asOf()
            ? (this.selected()?.finance?.closing ?? null)
            : null,
          this.store.asOf(),
        )
      : null,
  );
  readonly currentDeficit = computed(() => {
    const finance = this.selected()?.finance;
    const suppliers = this.supplierSummary();
    return !finance || !suppliers || this.store.to() !== this.store.asOf()
      ? null
      : Math.max(0, suppliers.pending + finance.position.refundPayable - finance.closing);
  });
  readonly charts = computed(() => {
    this.theme.isDark();
    const style = getComputedStyle(this.document.documentElement);
    const color = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    return buildBalanceCharts(
      this.filtered(),
      this.selected(),
      this.store.draft(),
      {
        text: color('--color-ink', 'currentColor'),
        grid: color('--color-line', 'transparent'),
        colors: [
          color('--p-blue-500', 'steelblue'),
          color('--p-emerald-500', 'seagreen'),
          color('--p-amber-500', 'goldenrod'),
          color('--p-red-500', 'indianred'),
          color('--p-violet-500', 'slateblue'),
          color('--p-cyan-500', 'teal'),
          color('--p-surface-500', 'gray'),
          color('--p-pink-500', 'palevioletred'),
          color('--p-orange-500', 'darkorange'),
        ],
      },
      this.store.from(),
      this.store.to(),
    );
  });
  readonly visibleCharts = computed(() =>
    this.charts().filter((chart) => chart.section === this.section()),
  );
  readonly heatmap = computed(() => {
    const budget = this.store.draft();
    if (!budget) return [];
    const paying = budget.totalPassengers - budget.freePassengers;
    return [-10, -5, 0, 5, 10].map((offset) => {
      const count = Math.max(1, paying + offset);
      return {
        count,
        cells: [-20, -10, 0, 10, 20].map((delta) => {
          const price = Math.round(budget.pricePerPayer * (1 + delta / 100));
          const result = calculateBalance({
            ...budget,
            totalPassengers: count + budget.freePassengers,
            pricePerPayer: price,
          });
          return { price, result: result.result };
        }),
      };
    });
  });
  readonly comparison = computed(() => {
    const state = this.selected()?.state;
    return [
      { name: 'Línea base', budget: state?.baseline },
      { name: 'Estimación guardada', budget: state?.current },
      ...this.store.scenarios().map((entry) => ({ name: entry.budget.name, budget: entry.budget })),
    ].map((entry) => ({
      name: entry.name,
      calculation: entry.budget ? calculateBalance(entry.budget) : null,
    }));
  });
  readonly valid = computed(
    () =>
      !!this.store.draft() &&
      !!this.store.calculation()?.cost &&
      this.store.calculation()?.errors.length === 0 &&
      this.reason().trim().length >= 5,
  );
  constructor() {
    void this.reload();
  }
  format(value: number | string | null | undefined): string {
    return value === null || value === undefined
      ? 'Sin datos'
      : typeof value === 'number'
        ? new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value)
        : value;
  }
  private confirm(message: string): Promise<boolean> {
    return new Promise((resolve) =>
      this.confirmation.confirm({
        header: 'Revisar antes de continuar',
        message,
        acceptLabel: 'Continuar',
        rejectLabel: 'Volver',
        accept: () => resolve(true),
        reject: () => resolve(false),
      }),
    );
  }
  async canLeave(): Promise<boolean> {
    return this.store.saving()
      ? false
      : !this.store.dirty() ||
          this.confirm('Tienes cambios sin guardar. ¿Quieres salir y descartarlos?');
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.dirty() || this.store.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  async reload(): Promise<void> {
    if (!(await this.canLeave())) return;
    if (
      !isDateOnly(this.from()) ||
      !isDateOnly(this.to()) ||
      this.from() > this.to() ||
      !Number.isInteger(this.year()) ||
      this.year() < 2000 ||
      this.year() > 2099
    ) {
      this.localError.set(
        'Revisa el período documental y las fechas. Usa un rango de hasta 12 meses.',
      );
      return;
    }
    const months =
      (Number(this.to().slice(0, 4)) - Number(this.from().slice(0, 4))) * 12 +
      Number(this.to().slice(5, 7)) -
      Number(this.from().slice(5, 7)) +
      1;
    if (months > 12) {
      this.localError.set('Consulta como máximo 12 meses por vez.');
      return;
    }
    this.localError.set('');
    this.selectedTrips.set([]);
    this.historical.set(false);
    await this.store.load(this.year(), this.from(), this.to());
  }
  async select(id: string, version?: number): Promise<void> {
    if (!(await this.canLeave())) return;
    this.historical.set(!!version);
    this.scenarioId.set('');
    await this.store.select(id, version);
  }
  async create(imported: boolean): Promise<void> {
    if (!this.canEdit() || !this.selected() || !(await this.canLeave())) return;
    this.localError.set('');
    if (!imported && (this.config.loading() || this.config.error())) {
      this.localError.set(
        'La configuración tributaria no está disponible. Reintenta su consulta antes de crear un presupuesto manual.',
      );
      await this.config.reload();
      return;
    }
    try {
      const next = imported
        ? importContractBudget(this.selected()!.trip, this.config.taxes(), this.today)
        : createBudget(this.selected()!.trip, this.config.taxes(), this.today);
      const previous = this.selected()?.state.current;
      if (previous) {
        const categoryIds = new Map(
          next.categories.map((category) => [
            category.id,
            previous.categories.find((current) => current.name === category.name)?.id ??
              category.id,
          ]),
        );
        next.categories = [
          ...previous.categories,
          ...next.categories.filter(
            (category) =>
              !previous.categories.some((current) => current.id === categoryIds.get(category.id)),
          ),
        ];
        next.lines = next.lines.map((line) => ({
          ...line,
          categoryId: categoryIds.get(line.categoryId) ?? line.categoryId,
        }));
      }
      this.store.edit(next);
      this.section.set('budget');
    } catch (error) {
      this.localError.set(error instanceof Error ? error.message : 'No fue posible importar.');
    }
  }
  edit(budget: BalanceBudget): void {
    if (this.canEdit()) this.store.edit(budget);
  }
  async save(action: BalanceCommand['action']): Promise<void> {
    if (!this.canEdit() || this.reason().trim().length < 5) {
      this.localError.set('Describe el motivo del cambio con al menos cinco caracteres.');
      return;
    }
    if (
      (action === 'APPROVE' || action === 'PROMOTE') &&
      !(await this.confirm(
        action === 'APPROVE'
          ? 'Se aprobará el presupuesto guardado como línea base. Las versiones anteriores se conservan. No cambian los contratos ni los pagos.'
          : 'Se adoptará el escenario guardado como estimación actual. No cambian la línea base ni los pagos.',
      ))
    )
      return;
    await this.store.save(action, this.reason().trim(), this.scenarioId());
  }
  async useScenario(id: string): Promise<void> {
    if (!(await this.canLeave())) return;
    const budget = this.store.scenarios().find((entry) => entry.id === id)?.budget;
    if (budget) {
      this.scenarioId.set(id);
      this.store.draft.set(structuredClone(budget));
      this.store.dirty.set(false);
      this.section.set('simulation');
    }
  }
  async export(): Promise<void> {
    this.exporting.set(true);
    try {
      await exportBalance(this.tableRows(), this.store.draft(), {
        'Período documental': String(this.year()),
        'Rango de movimientos': `${this.store.from()} a ${this.store.to()}`,
        'Posición actual consultada': this.store.asOf(),
        'Búsqueda institución/curso': this.search(),
        Destino: this.destination() ?? 'Todos',
        'Año de salida': String(this.departureYear() ?? 'Todos'),
        Viajes: this.selectedTrips().join(', ') || 'Todos los filtrados',
        Escenario: this.store.draft()?.name ?? 'Estimaciones guardadas',
        Versión: String(this.selected()?.state.version ?? ''),
        'Cambios sin guardar': this.store.dirty() ? 'Sí' : 'No',
      });
    } catch {
      this.localError.set('No fue posible exportar. Reintenta.');
    } finally {
      this.exporting.set(false);
    }
  }
}

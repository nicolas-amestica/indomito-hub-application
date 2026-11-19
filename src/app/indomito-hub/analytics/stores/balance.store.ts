import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BalanceService } from '../services/balance.service';
import type {
  BalanceBudget,
  BalanceCommand,
  BalanceDetail,
  BalanceRow,
} from '../interfaces/balance.interface';
import { calculateBalance } from '../fn/calculate-balance';
import { balanceId } from '../fn/balance-id';

/** Estado local: descarta respuestas obsoletas y conserva borradores tras fallos. */
@Injectable()
export class BalanceStore {
  private readonly api = inject(BalanceService);
  private pending: { tripId: string; intent: string; command: BalanceCommand } | null = null;
  private generation = 0;
  private detailGeneration = 0;
  readonly rows = signal<BalanceRow[]>([]);
  readonly detail = signal<BalanceDetail | null>(null);
  readonly draft = signal<BalanceBudget | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly updatedAt = signal('');
  readonly calculation = computed(() => (this.draft() ? calculateBalance(this.draft()!) : null));
  readonly revisions = computed(() => this.detail()?.revisions ?? []);
  readonly scenarios = computed(() =>
    Object.entries(this.detail()?.row.state.scenarios ?? {}).map(([id, budget]) => ({
      id,
      budget,
    })),
  );
  readonly from = signal('');
  readonly to = signal('');
  readonly asOf = signal('');

  async load(year: number, from: string, to: string): Promise<void> {
    const generation = ++this.generation;
    ++this.detailGeneration;
    this.detail.set(null);
    this.draft.set(null);
    this.dirty.set(false);
    this.loading.set(true);
    this.error.set('');
    this.from.set(from);
    this.to.set(to);
    try {
      const rows: BalanceRow[] = [];
      let cursor = '';
      const seen = new Set<string>();
      do {
        const page = await firstValueFrom(this.api.list(year, from, to, cursor));
        if (generation !== this.generation) return;
        rows.push(...page.items);
        this.asOf.set(page.asOf);
        this.updatedAt.set(page.updatedAt);
        cursor = page.nextCursor ?? '';
        if (cursor && seen.has(cursor)) throw new Error('Paginación inconsistente');
        seen.add(cursor);
      } while (cursor);
      this.rows.set(rows);
    } catch {
      if (generation === this.generation) {
        this.rows.set([]);
        this.error.set('No pudimos cargar los viajes. Reintenta; los datos no se consideran cero.');
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async select(id: string, version?: number): Promise<void> {
    const generation = ++this.detailGeneration;
    this.detailLoading.set(true);
    this.error.set('');
    this.draft.set(null);
    this.detail.set(null);
    this.dirty.set(false);
    try {
      const detail = await firstValueFrom(this.api.detail(id, this.from(), this.to(), version));
      if (generation !== this.detailGeneration) return;
      this.detail.set(detail);
      this.draft.set(detail.row.state.current ? structuredClone(detail.row.state.current) : null);
      this.asOf.set(detail.asOf);
    } catch {
      if (generation === this.detailGeneration)
        this.error.set('No pudimos abrir el viaje. Reintenta.');
    } finally {
      if (generation === this.detailGeneration) this.detailLoading.set(false);
    }
  }
  edit(budget: BalanceBudget): void {
    this.draft.set(budget);
    this.dirty.set(true);
    this.notice.set('');
  }
  async save(action: BalanceCommand['action'], reason: string, scenarioId = ''): Promise<boolean> {
    const detail = this.detail();
    if (!detail || this.saving()) return false;
    this.saving.set(true);
    this.error.set('');
    let command: BalanceCommand = {
      commandId: balanceId(),
      version: detail.row.state.version,
      action,
      scenarioId: action === 'SCENARIO' ? scenarioId || balanceId() : scenarioId,
      reason,
      budget: action === 'SAVE' || action === 'SCENARIO' ? this.draft() : null,
    };
    const intent = JSON.stringify({
      version: command.version,
      action,
      scenarioId,
      reason,
      budget: command.budget,
    });
    if (this.pending?.tripId === detail.row.trip.id && this.pending.intent === intent)
      command = this.pending.command;
    else this.pending = { tripId: detail.row.trip.id, intent, command };
    try {
      const state = await firstValueFrom(this.api.save(detail.row.trip.id, command));
      this.pending = null;
      const row = { ...detail.row, state };
      this.detail.set({ ...detail, row, revisions: [state, ...detail.revisions] });
      this.rows.update((rows) =>
        rows.map((entry) => (entry.trip.id === row.trip.id ? { ...entry, state } : entry)),
      );
      if (action !== 'SCENARIO')
        this.draft.set(state.current ? structuredClone(state.current) : null);
      this.dirty.set(false);
      this.notice.set(
        action === 'APPROVE'
          ? 'Línea base aprobada. La versión anterior sigue disponible.'
          : action === 'SCENARIO'
            ? 'Escenario guardado. El contrato y los pagos no cambiaron.'
            : action === 'PROMOTE'
              ? 'Escenario adoptado como estimación actual.'
              : 'Borrador guardado. Todavía no cambia la línea base.',
      );
      return true;
    } catch {
      this.error.set(
        'No pudimos guardar. Conservamos tus cambios. Si otra persona actualizó el presupuesto, revisa la versión vigente antes de reintentar.',
      );
      return false;
    } finally {
      this.saving.set(false);
    }
  }
}

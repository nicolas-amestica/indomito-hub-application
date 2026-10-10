import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { newUlid } from '../../../../shared/fn/new-ulid';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';
import type {
  CollectionSettlement,
  ReconcileSettlementRequest,
  TripCashView,
} from '../../interfaces/collection-treasury.interface';
import { CollectionTreasury } from '../../services/collection-treasury';

@Component({
  selector: 'app-trip-treasury',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    Checkbox,
    DateOnlyPickerComponent,
    InputNumber,
    InputText,
    Message,
    Panel,
    TableModule,
    Textarea,
  ],
  templateUrl: './trip-treasury.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripTreasuryPage {
  private readonly api = inject(CollectionTreasury);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tripId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly settlements = signal<CollectionSettlement[]>([]);
  protected readonly cash = signal<TripCashView | null>(null);
  protected readonly selected = signal<CollectionSettlement | null>(null);
  protected pending: ReconcileSettlementRequest | null = null;

  protected readonly periodForm = new FormGroup({
    from: new FormControl(this.monthBoundary(1), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    to: new FormControl(this.monthBoundary(0), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  protected readonly reconcileForm = new FormGroup({
    gross: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    fee: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    bankReference: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(150)],
    }),
    effectiveDate: new FormControl(todayDateOnly(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    reviewed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  constructor() {
    if (!this.tripId) {
      this.error.set('No se identificó la gira.');
      return;
    }
    const command = this.route.snapshot.queryParamMap.get('operacion');
    const payment = this.route.snapshot.queryParamMap.get('pago');
    if (command && payment) this.recover(command, payment);
    else this.refresh();
  }

  protected select(settlement: CollectionSettlement): void {
    if (this.pending) return;
    this.selected.set(settlement);
    this.reconcileForm.reset({
      gross: settlement.amount - settlement.settledGross,
      fee: 0,
      bankReference: '',
      effectiveDate: todayDateOnly(),
      reason: '',
      reviewed: false,
    });
  }

  protected refresh(): void {
    if (this.busy() || !this.tripId) return;
    this.busy.set(true);
    this.error.set('');
    const period = this.periodForm.getRawValue();
    this.loadSettlementPage('', [])
      .then(() => {
        this.api
          .getCash(this.tripId, period.from, period.to)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.busy.set(false)),
          )
          .subscribe({
            next: (cash) => this.cash.set(cash),
            error: () => this.error.set('No fue posible cargar la caja de esta gira.'),
          });
      })
      .catch(() => {
        this.busy.set(false);
        this.error.set('No fue posible cargar las liquidaciones de esta gira.');
      });
  }

  protected reconcile(): void {
    const settlement = this.selected();
    if (!settlement || this.busy()) return;
    this.error.set('');
    if (!this.pending) {
      this.reconcileForm.markAllAsTouched();
      const value = this.reconcileForm.getRawValue();
      const remaining = settlement.amount - settlement.settledGross;
      if (
        this.reconcileForm.invalid ||
        !Number.isSafeInteger(value.gross) ||
        !Number.isSafeInteger(value.fee) ||
        value.gross > remaining ||
        value.fee > value.gross
      ) {
        this.error.set('Revisa el monto bruto, la comisión y la confirmación de cartola.');
        return;
      }
      this.pending = {
        commandId: newUlid(),
        version: settlement.version,
        gross: value.gross,
        fee: value.fee,
        bankReference: value.bankReference.trim(),
        effectiveDate: value.effectiveDate,
        reason: value.reason.trim(),
      };
      this.reconcileForm.disable();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          operacion: this.pending.commandId,
          pago: settlement.paymentReference.replace(/^khipu:/, ''),
        },
        replaceUrl: true,
      });
    }
    this.busy.set(true);
    this.api
      .reconcile(this.tripId, settlement.paymentReference, this.pending)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.pending = null;
          this.selected.set(null);
          this.reconcileForm.enable();
          this.success.set('La liquidación quedó conciliada y auditada.');
          this.busy.set(false);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
          this.refresh();
        },
        error: () =>
          this.error.set(
            'No se confirmó el resultado. Reintenta sin modificar los datos para conservar la misma operación.',
          ),
      });
  }

  private recover(commandId: string, paymentId: string): void {
    this.busy.set(true);
    this.api
      .recoverOperation(commandId, 'SETTLEMENT', paymentId, this.tripId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.success.set(
            'La conciliación pendiente ya estaba aplicada. Se recuperó el resultado durable.',
          );
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
          this.busy.set(false);
          this.refresh();
        },
        error: () => {
          this.busy.set(false);
          this.refresh();
          this.error.set(
            'No existe un resultado aplicado para esa conciliación. Revisa la cartola antes de volver a ingresarla.',
          );
        },
      });
  }

  private loadSettlementPage(cursor: string, accumulated: CollectionSettlement[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api
        .listSettlements(this.tripId, cursor)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (page) => {
            const all = [...accumulated, ...page.items];
            if (page.nextCursor)
              this.loadSettlementPage(page.nextCursor, all).then(resolve, reject);
            else {
              this.settlements.set(all);
              resolve();
            }
          },
          error: reject,
        });
    });
  }

  private monthBoundary(dayOffset: 0 | 1): string {
    const now = new Date();
    return dayOffset === 1
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      : todayDateOnly();
  }
}

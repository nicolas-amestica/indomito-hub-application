import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Panel } from 'primeng/panel';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Checkbox } from 'primeng/checkbox';
import { Textarea } from 'primeng/textarea';
import { CollectionAccounts } from '../../services/collection-accounts';
import { CollectionTreasury } from '../../services/collection-treasury';
import { PaymentReceipts } from '../../../../shared/payment-receipts/components/payment-receipts';
import { ACCOUNT_OPERATIONS } from '../../constants/account-operations';
import type {
  AccountOperation,
  AccountOperationRequest,
  CollectionAccount,
} from '../../interfaces/collection-account.interface';
import type { AccountAttemptSummary } from '../../interfaces/attempt-reconciliation.interface';
import { newUlid } from '../../../../shared/fn/new-ulid';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';

@Component({
  selector: 'app-account-operations',
  imports: [
    PaymentReceipts,
    CurrencyPipe,
    RouterLink,
    ReactiveFormsModule,
    DateOnlyPickerComponent,
    ButtonDirective,
    Panel,
    Message,
    Select,
    MultiSelect,
    InputText,
    InputNumber,
    Checkbox,
    Textarea,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-operations.page.html',
})
export class AccountOperationsPage {
  private readonly api = inject(CollectionAccounts);
  private readonly treasury = inject(CollectionTreasury);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private pending: AccountOperationRequest | null = null;
  protected readonly account = signal<CollectionAccount | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal(false);
  protected readonly attempts = signal<AccountAttemptSummary[]>([]);
  protected readonly attemptsCursor = signal('');
  protected readonly attemptsLoaded = signal(false);
  protected readonly options = ACCOUNT_OPERATIONS;
  protected readonly form = new FormGroup({
    operation: new FormControl<AccountOperation>('MANUAL_INSTALLMENT', { nonNullable: true }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    amount: new FormControl(0, { nonNullable: true }),
    percentage: new FormControl(0, { nonNullable: true }),
    installmentIds: new FormControl<string[]>([], { nonNullable: true }),
    reference: new FormControl('', { nonNullable: true }),
    effectiveDate: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(254)],
    }),
    reviewed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
  protected readonly operation = toSignal(this.form.controls.operation.valueChanges, {
    initialValue: 'MANUAL_INSTALLMENT' as AccountOperation,
  });
  protected readonly isBank = computed(() =>
    ['MANUAL_INSTALLMENT', 'RECORD_DEPOSIT', 'CONFIRM_REFUND'].includes(this.operation()),
  );
  protected readonly needsAmount = computed(() =>
    ['RECORD_DEPOSIT', 'APPROVE_UNAPPLIED_REFUND', 'CONFIRM_REFUND'].includes(this.operation()),
  );
  protected readonly needsPercentage = computed(() =>
    ['DISCOUNT', 'APPROVE_WITHDRAWAL_REFUND'].includes(this.operation()),
  );
  protected readonly quotas = computed(
    () =>
      this.account()?.installments.map((q, index) => ({
        ...q,
        label: `Cuota ${index + 1} · ${q.dueDate}`,
        outstanding: q.original - q.discount - q.cancelled - q.paid,
      })) ?? [],
  );
  protected readonly pendingQuotas = computed(() => this.quotas().filter((q) => q.outstanding > 0));
  protected readonly refundPending = computed(() => {
    const a = this.account();
    return a ? a.withdrawalRefundApproved + a.unappliedRefundApproved - a.refunded : 0;
  });
  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.account.set(null);
          this.busy.set(true);
          this.error.set('');
          this.pending = null;
          this.attempts.set([]);
          this.attemptsCursor.set('');
          this.attemptsLoaded.set(false);
          this.form.enable();
          this.success.set(false);
        }),
        switchMap((params) =>
          this.api.get(params.get('id') ?? '').pipe(
            catchError(() => {
              this.busy.set(false);
              this.error.set('No se pudo cargar la cuenta. Verifica tus permisos.');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((account) => {
        this.account.set(account);
        this.busy.set(false);
        const command = this.route.snapshot.queryParamMap.get('operacion');
        if (command) this.recover(command, account.id);
      });
  }
  protected save(): void {
    const account = this.account();
    if (!account || this.busy()) return;
    this.error.set('');
    this.success.set(false);
    if (!this.pending) {
      this.form.markAllAsTouched();
      const v = this.form.getRawValue();
      if (
        this.form.invalid ||
        v.reason.trim().length < 5 ||
        (this.needsAmount() && (!Number.isSafeInteger(v.amount) || v.amount <= 0)) ||
        (this.needsPercentage() &&
          (!Number.isFinite(v.percentage) || v.percentage < 0 || v.percentage > 100)) ||
        (['DISCOUNT', 'ALLOCATE_UNAPPLIED'].includes(v.operation) && !v.installmentIds.length) ||
        (v.operation === 'DISCOUNT' && v.percentage <= 0) ||
        (this.isBank() &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(v.effectiveDate) || v.reference.trim().length < 5)) ||
        (this.isBank() && v.operation !== 'CONFIRM_REFUND' && !v.email)
      ) {
        this.error.set('Revisa los campos requeridos y confirma que verificaste la operación.');
        return;
      }
      this.pending = {
        commandId: newUlid(),
        version: account.version,
        operation: v.operation,
        reason: v.reason.trim(),
      };
      if (this.needsAmount()) this.pending.amount = v.amount;
      if (this.needsPercentage()) this.pending.basisPoints = Math.round(v.percentage * 100);
      if (['DISCOUNT', 'ALLOCATE_UNAPPLIED'].includes(v.operation))
        this.pending.installmentIds = [...v.installmentIds];
      if (this.isBank()) {
        this.pending.reference = v.reference.trim();
        this.pending.effectiveDate = v.effectiveDate;
        if (v.operation !== 'CONFIRM_REFUND') this.pending.email = v.email;
      }
      this.form.disable();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { operacion: this.pending.commandId },
        replaceUrl: true,
      });
    }
    this.busy.set(true);
    this.api
      .apply(account.id, this.pending)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          if (this.account()?.id !== account.id) return;
          this.account.set(updated);
          this.pending = null;
          this.form.reset();
          this.form.enable();
          this.busy.set(false);
          this.success.set(true);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
        },
        error: () => {
          if (this.account()?.id !== account.id) return;
          this.busy.set(false);
          this.error.set(
            'No se confirmó el resultado. Reintenta la misma operación: se conserva su referencia y contenido. Si existe un conflicto, revisa la cuenta antes de registrar otra operación.',
          );
        },
      });
  }
  private recover(commandId: string, accountId: string): void {
    this.busy.set(true);
    this.treasury
      .recoverOperation(commandId, 'ACCOUNT', accountId)
      .pipe(
        switchMap(() => this.api.get(accountId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (account) => {
          this.account.set(account);
          this.busy.set(false);
          this.success.set(true);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'No existe un resultado aplicado para la operación pendiente. Revisa la cuenta antes de volver a ingresarla.',
          );
        },
      });
  }
  protected loadAttempts(more = false): void {
    const account = this.account();
    if (!account || this.busy()) return;
    this.busy.set(true);
    this.api
      .attempts(account.id, more ? this.attemptsCursor() : '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (this.account()?.id !== account.id) return;
          this.attempts.update((items) => (more ? [...items, ...page.items] : page.items));
          this.attemptsCursor.set(page.nextCursor ?? '');
          this.attemptsLoaded.set(true);
          this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('No se pudo cargar el historial de intentos.');
        },
      });
  }
}

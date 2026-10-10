import { CurrencyPipe } from '@angular/common';
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
  SupplierCommitment,
  SupplierOperationRequest,
  SupplierOperationType,
} from '../../interfaces/collection-treasury.interface';
import { CollectionTreasury } from '../../services/collection-treasury';

@Component({
  selector: 'app-trip-suppliers',
  imports: [
    CurrencyPipe,
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
  templateUrl: './trip-suppliers.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripSuppliersPage {
  private readonly api = inject(CollectionTreasury);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tripId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly suppliers = signal<SupplierCommitment[]>([]);
  protected readonly selected = signal<SupplierCommitment | null>(null);
  protected readonly operation = signal<SupplierOperationType | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected pending: { supplierId: string; request: SupplierOperationRequest } | null = null;
  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    service: new FormControl('', { nonNullable: true }),
    committed: new FormControl(0, { nonNullable: true }),
    refundAgreed: new FormControl(0, { nonNullable: true }),
    amount: new FormControl(0, { nonNullable: true }),
    reference: new FormControl('', { nonNullable: true }),
    effectiveDate: new FormControl(todayDateOnly(), { nonNullable: true }),
    annexId: new FormControl('', { nonNullable: true }),
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
    const supplier = this.route.snapshot.queryParamMap.get('proveedor');
    if (command && supplier) this.recover(command, supplier);
    else this.load();
  }

  protected begin(
    operation: SupplierOperationType,
    supplier: SupplierCommitment | null = null,
  ): void {
    if (this.pending || this.busy()) return;
    this.operation.set(operation);
    this.selected.set(supplier);
    this.error.set('');
    this.form.reset({
      name: supplier?.name ?? '',
      service: supplier?.service ?? '',
      committed: supplier?.committed ?? 0,
      refundAgreed: supplier?.refundAgreed ?? 0,
      amount: 0,
      reference: '',
      effectiveDate: todayDateOnly(),
      annexId: '',
      reason: '',
      reviewed: false,
    });
  }

  protected cancel(): void {
    if (!this.pending && !this.busy()) {
      this.operation.set(null);
      this.selected.set(null);
    }
  }

  protected save(): void {
    const operation = this.operation();
    if (!operation || this.busy()) return;
    this.error.set('');
    if (!this.pending) {
      this.form.markAllAsTouched();
      const value = this.form.getRawValue();
      const supplier = this.selected();
      const createInvalid =
        operation === 'CREATE' &&
        (value.name.trim().length < 2 || value.service.trim().length < 2 || value.committed <= 0);
      const reviseInvalid =
        operation === 'REVISE' &&
        (value.committed < 0 || value.refundAgreed < 0 || value.annexId.trim().length < 5);
      const bankInvalid =
        (operation === 'PAY' || operation === 'RECEIVE_REFUND') &&
        (value.amount <= 0 ||
          value.reference.trim().length < 5 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value.effectiveDate));
      if (this.form.invalid || createInvalid || reviseInvalid || bankInvalid) {
        this.error.set('Revisa los datos y confirma la evidencia de respaldo.');
        return;
      }
      const supplierId = supplier?.id ?? newUlid();
      this.pending = {
        supplierId,
        request: {
          commandId: newUlid(),
          version: supplier?.version ?? 0,
          operation,
          name: value.name.trim(),
          service: value.service.trim(),
          committed: value.committed,
          refundAgreed: value.refundAgreed,
          amount: value.amount,
          reference: value.reference.trim(),
          effectiveDate: value.effectiveDate,
          annexId: value.annexId.trim(),
          reason: value.reason.trim(),
        },
      };
      this.form.disable();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { operacion: this.pending.request.commandId, proveedor: supplierId },
        replaceUrl: true,
      });
    }
    this.busy.set(true);
    this.api
      .operateSupplier(this.tripId, this.pending.supplierId, this.pending.request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.pending = null;
          this.form.enable();
          this.operation.set(null);
          this.selected.set(null);
          this.success.set('La operación quedó aplicada y auditada.');
          this.busy.set(false);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
          this.load();
        },
        error: () =>
          this.error.set(
            'No se confirmó el resultado. Recarga o reintenta esta misma operación sin cambiar sus datos.',
          ),
      });
  }

  private recover(commandId: string, supplierId: string): void {
    this.busy.set(true);
    this.api
      .recoverOperation(commandId, 'SUPPLIER', supplierId, this.tripId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.success.set(
            'La operación pendiente ya estaba aplicada. Se recuperó el resultado durable.',
          );
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
          this.busy.set(false);
          this.load();
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'No existe un resultado aplicado para la operación pendiente. Puedes volver a ingresar los datos verificados.',
          );
          this.load();
        },
      });
  }

  private load(cursor = '', accumulated: SupplierCommitment[] = []): void {
    this.busy.set(true);
    this.api
      .listSuppliers(this.tripId, cursor)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!cursor) this.busy.set(false);
        }),
      )
      .subscribe({
        next: (page) => {
          const all = [...accumulated, ...page.items];
          if (page.nextCursor) this.load(page.nextCursor, all);
          else {
            this.suppliers.set(all);
            this.busy.set(false);
          }
        },
        error: () => {
          this.busy.set(false);
          this.error.set('No fue posible cargar los proveedores.');
        },
      });
  }
}

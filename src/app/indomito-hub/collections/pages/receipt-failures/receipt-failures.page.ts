import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { newUlid } from '../../../../shared/fn/new-ulid';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';
import type { ReceiptFailure } from '../../interfaces/receipt-failure.interface';
import { CollectionReceiptFailures } from '../../services/collection-receipt-failures';

@Component({
  selector: 'app-receipt-failures',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    DateOnlyPickerComponent,
    Message,
    TableModule,
    Textarea,
  ],
  templateUrl: './receipt-failures.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptFailuresPage {
  private readonly api = inject(CollectionReceiptFailures);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly items = signal<ReceiptFailure[]>([]);
  protected readonly nextCursor = signal('');
  private pending: {
    receiptId: string;
    request: { commandId: string; deliveryId?: string; reason: string };
  } | null = null;
  protected readonly form = new FormGroup({
    date: new FormControl(todayDateOnly(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
  });
  constructor() {
    this.load(false);
  }
  protected load(more: boolean): void {
    if (this.busy()) return;
    const { date } = this.form.getRawValue();
    if (!date) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .list(date, more ? this.nextCursor() : '')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (page) => {
          this.items.update((current) => (more ? [...current, ...page.items] : page.items));
          this.nextCursor.set(page.nextCursor ?? '');
        },
        error: () => this.error.set('No fue posible consultar las entregas fallidas.'),
      });
  }
  protected retry(item: ReceiptFailure): void {
    this.form.controls.reason.markAsTouched();
    const reason = this.form.controls.reason.value.trim();
    if (this.form.controls.reason.invalid || !reason) {
      this.error.set('Indica el motivo y la verificación realizada antes de reintentar.');
      return;
    }
    if (!this.pending)
      this.pending = {
        receiptId: item.receiptId,
        request: { commandId: newUlid(), deliveryId: item.deliveryId, reason },
      };
    if (
      this.pending.receiptId !== item.receiptId ||
      this.pending.request.deliveryId !== item.deliveryId
    ) {
      this.error.set('Hay otro reintento pendiente. Recarga antes de continuar.');
      return;
    }
    this.busy.set(true);
    this.api
      .retry(item.receiptId, this.pending.request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.pending = null;
          this.items.update((items) =>
            items.filter(
              (candidate) =>
                candidate.receiptId !== item.receiptId || candidate.deliveryId !== item.deliveryId,
            ),
          );
          this.success.set(
            'Reintento encolado. El pago y el comprobante original no fueron modificados.',
          );
        },
        error: () =>
          this.error.set('Resultado incierto. Recarga la lista antes de crear otro reintento.'),
      });
  }
}

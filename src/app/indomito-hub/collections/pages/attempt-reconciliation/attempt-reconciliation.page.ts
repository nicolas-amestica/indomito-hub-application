import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { Textarea } from 'primeng/textarea';
import { newUlid } from '../../../../shared/fn/new-ulid';
import type {
  AttemptReconciliationRequest,
  AttemptReconciliationState,
} from '../../interfaces/attempt-reconciliation.interface';
import { AttemptReconciliation } from '../../services/attempt-reconciliation';
@Component({
  selector: 'app-attempt-reconciliation',
  imports: [
    CurrencyPipe,
    RouterLink,
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    InputText,
    Message,
    Panel,
    Textarea,
  ],
  templateUrl: './attempt-reconciliation.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttemptReconciliationPage {
  private readonly api = inject(AttemptReconciliation);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly attemptId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<AttemptReconciliationState | null>(null);
  private pending: AttemptReconciliationRequest | null = null;
  protected readonly form = new FormGroup({
    paymentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^[a-zA-Z0-9]{12}$/)],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    reviewed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
  protected reconcile(): void {
    if (this.busy() || !this.attemptId) return;
    this.error.set('');
    if (!this.pending) {
      this.form.markAllAsTouched();
      if (this.form.invalid) {
        this.error.set('Revisa el identificador, el motivo y confirma la consulta autoritativa.');
        return;
      }
      const v = this.form.getRawValue();
      this.pending = {
        commandId: newUlid(),
        reason: v.reason.trim(),
        ...(v.paymentId ? { paymentId: v.paymentId } : {}),
      };
      this.form.disable();
    }
    this.busy.set(true);
    this.api
      .reconcile(this.attemptId, this.pending)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.result.set(state);
          this.busy.set(false);
          if (state.status !== 'PENDING' && state.status !== 'REVIEW_REQUIRED') this.pending = null;
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'No se pudo confirmar el estado. No liberes la cuota ni crees otro cobro; reintenta esta misma consulta.',
          );
        },
      });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Panel } from 'primeng/panel';
import { Message } from 'primeng/message';
import { ReceiptApi } from '../services/receipt-api';
import { safeReceiptUrl } from '../fn/safe-receipt-url';
import type {
  ReceiptDeliveryView,
  ReceiptScope,
  ReceiptView,
} from '../interfaces/receipt.interface';
import { receiptEmailForm } from '../fn/receipt-email-form';
import { newUlid } from '../../fn/new-ulid';

@Component({
  selector: 'app-payment-receipts',
  imports: [
    CurrencyPipe,
    DatePipe,
    ButtonDirective,
    Panel,
    Message,
    ReactiveFormsModule,
    InputText,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-receipts.html',
})
export class PaymentReceipts {
  readonly accountId = input('');
  readonly tripId = input('');
  private readonly api = inject(ReceiptApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scopeKey = computed(() => `${this.accountId()}|${this.tripId()}`);
  protected readonly view = linkedSignal<string, ReceiptView>({
    source: this.scopeKey,
    computation: () => ({ items: [], cursor: '', loaded: false, busy: false, error: '', url: '' }),
  });
  protected readonly delivery = linkedSignal<string, ReceiptDeliveryView>({
    source: this.scopeKey,
    computation: () => ({ receiptId: '', request: null, busy: false, queued: false, error: '' }),
  });
  protected readonly emailForm = linkedSignal({
    source: this.scopeKey,
    computation: () => receiptEmailForm(),
  });
  private expiryTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.expiryTimer));
  }
  protected selectResend(id: string): void {
    if (this.delivery().busy || this.delivery().request) return;
    this.emailForm().reset();
    this.delivery.set({ receiptId: id, request: null, busy: false, queued: false, error: '' });
  }
  protected resend(): void {
    if (this.delivery().busy || !this.delivery().receiptId || this.delivery().queued) return;
    const form = this.emailForm();
    if (!this.delivery().request && form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const scope = this.scope();
    if (!scope) return;
    const key = this.scopeKey();
    const request = this.delivery().request ?? {
      commandId: newUlid(),
      email: form.controls.email.value.trim(),
    };
    const id = this.delivery().receiptId;
    form.disable();
    this.delivery.update((v) => ({ ...v, request, busy: true, error: '' }));
    this.api
      .resend(scope, id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (key !== this.scopeKey()) return;
          this.delivery.update((v) => ({ ...v, busy: false, queued: true, request: null }));
          form.enable();
        },
        error: () => {
          if (key !== this.scopeKey()) return;
          this.delivery.update((v) => ({
            ...v,
            busy: false,
            error:
              'No pudimos confirmar el reenvío. Reintenta esta misma solicitud. El PDF debe estar disponible.',
          }));
        },
      });
  }
  protected load(more = false): void {
    if (this.view().busy) return;
    const scope = this.scope();
    if (!scope) return;
    const key = this.scopeKey();
    this.view.update((v) => ({ ...v, busy: true, error: '', url: '' }));
    this.api
      .list(scope, more ? this.view().cursor : '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (key !== this.scopeKey()) return;
          this.view.update((v) => ({
            ...v,
            items: more ? [...v.items, ...page.items] : page.items,
            cursor: page.nextCursor ?? '',
            loaded: true,
            busy: false,
          }));
        },
        error: () => this.fail(key, 'No pudimos consultar los comprobantes. Intenta nuevamente.'),
      });
  }
  protected download(id: string): void {
    if (this.view().busy) return;
    const scope = this.scope();
    if (!scope) return;
    const key = this.scopeKey();
    this.view.update((v) => ({ ...v, busy: true, error: '', url: '' }));
    this.api
      .download(scope, id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (key !== this.scopeKey()) return;
          const url = safeReceiptUrl(result.url);
          if (!url || !Number.isFinite(result.expiresIn) || result.expiresIn <= 0) {
            this.fail(key, 'No pudimos preparar un enlace seguro. Intenta nuevamente.');
            return;
          }
          this.view.update((v) => ({ ...v, busy: false, url }));
          clearTimeout(this.expiryTimer);
          this.expiryTimer = setTimeout(
            () => {
              if (key === this.scopeKey()) this.view.update((v) => ({ ...v, url: '' }));
            },
            Math.min(120, result.expiresIn) * 1000,
          );
        },
        error: () =>
          this.fail(
            key,
            'El PDF todavía no está disponible o no pudo descargarse. Intenta nuevamente más tarde.',
          ),
      });
  }
  private scope(): ReceiptScope | null {
    if (this.tripId()) return { tripId: this.tripId() };
    if (this.accountId()) return { accountId: this.accountId() };
    this.view.update((v) => ({
      ...v,
      error: 'Selecciona una cuenta o gira para gestionar sus comprobantes.',
      url: '',
    }));
    return null;
  }
  private fail(key: string, error: string): void {
    if (key === this.scopeKey()) this.view.update((v) => ({ ...v, busy: false, error, url: '' }));
  }
}

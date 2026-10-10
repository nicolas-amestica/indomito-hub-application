import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Dialog } from 'primeng/dialog';
import { TreasuryApiService } from '../services/treasury-api.service';
import type { TreasuryExpense, TreasuryView } from '../interfaces/treasury.interface';
import { DateOnlyPickerComponent } from '../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../shared/date-only/date-only';

/** Tesorería por viaje con vocabulario operativo y proyección de caja. */
@Component({
  selector: 'app-treasury-page',
  imports: [
    CurrencyPipe,
    DateOnlyPickerComponent,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    InputText,
    InputNumber,
    Panel,
    TableModule,
    Message,
    Select,
    Dialog,
  ],
  templateUrl: './treasury.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuryPage {
  private readonly api = inject(TreasuryApiService);
  protected readonly key = new FormControl('', { nonNullable: true });
  protected readonly scope = new FormControl('', { nonNullable: true });
  protected readonly view = signal<TreasuryView | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly selected = signal<TreasuryExpense | null>(null);
  protected readonly amount = new FormControl(0, { nonNullable: true });
  protected readonly scopes = [
    { label: 'Toda la empresa', value: '' },
    { label: 'Gira de demostración', value: 'gira-demo' },
    { label: 'Gastos de empresa', value: 'company' },
  ];
  protected readonly categories = [
    'Alojamiento',
    'Transporte',
    'Alimentación',
    'Actividades',
    'Seguros',
    'Guía',
    'Bolsos',
    'Premios de rifas',
    'Gastos operacionales',
    'Publicidad y AWS',
    'Otros',
  ];
  protected readonly destinations = this.scopes.slice(1);
  protected readonly form = new FormGroup({
    tripId: new FormControl('gira-demo', { nonNullable: true }),
    category: new FormControl('Alojamiento', { nonNullable: true }),
    supplier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    dueDate: new FormControl(todayDateOnly(), {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)],
    }),
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(1_000_000_000)],
    }),
  });
  protected readonly unsettled = computed(
    () => this.view()?.payments.filter((p) => p.status === 'CONFIRMED' && !p.settledAt) ?? [],
  );
  protected readonly hasShortfall = computed(
    () => this.view()?.forecast.some((m) => m.closing < 0) ?? false,
  );
  protected async refresh(): Promise<void> {
    await this.run(async () => this.load());
  }
  protected async createExpense(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    await this.run(async () => {
      await firstValueFrom(
        this.api.expense(this.key.value, this.form.getRawValue(), crypto.randomUUID()),
      );
      this.form.controls.supplier.reset();
      this.form.controls.amount.reset();
      await this.load();
    });
  }
  protected chooseExpense(expense: TreasuryExpense): void {
    this.selected.set(expense);
    this.amount.setValue(expense.amount - expense.paid);
  }
  protected async payExpense(): Promise<void> {
    const expense = this.selected();
    if (!expense) return;
    await this.run(async () => {
      await firstValueFrom(
        this.api.pay(this.key.value, expense.id, this.amount.value, crypto.randomUUID()),
      );
      this.selected.set(null);
      await this.load();
    });
  }
  protected async settle(id: string): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.settle(this.key.value, id));
      await this.load();
    });
  }
  protected lock(): void {
    this.view.set(null);
    this.key.reset();
  }
  private async load(): Promise<void> {
    this.view.set(await firstValueFrom(this.api.view(this.key.value, this.scope.value)));
  }
  private async run(fn: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await fn();
    } catch {
      this.error.set(
        'No fue posible completar la operación. Revisa la clave local, los montos y la conexión.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}

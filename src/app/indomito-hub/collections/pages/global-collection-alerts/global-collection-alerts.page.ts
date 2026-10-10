import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import type { GlobalCollectionAlertView } from '../../interfaces/collection-treasury.interface';
import { CollectionTreasury } from '../../services/collection-treasury';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';

@Component({
  selector: 'app-global-collection-alerts',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    DateOnlyPickerComponent,
    InputNumber,
    Message,
    Panel,
    TableModule,
  ],
  templateUrl: './global-collection-alerts.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalCollectionAlertsPage {
  private readonly api = inject(CollectionTreasury);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly view = signal<GlobalCollectionAlertView | null>(null);
  protected readonly form = new FormGroup({
    year: new FormControl(new Date().getFullYear(), {
      nonNullable: true,
      validators: [Validators.min(2025), Validators.max(2100)],
    }),
    asOf: new FormControl(todayDateOnly(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  constructor() {
    this.load();
  }
  protected load(): void {
    if (this.busy() || this.form.invalid) return;
    const value = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.api
      .getGlobalAlerts(value.year, value.asOf)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (view) => this.view.set(view),
        error: () => this.error.set('No fue posible calcular el resumen de grupos.'),
      });
  }
}

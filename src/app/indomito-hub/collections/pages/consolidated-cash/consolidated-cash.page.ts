import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import type { ConsolidatedCashView } from '../../interfaces/collection-treasury.interface';
import { CollectionTreasury } from '../../services/collection-treasury';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';

@Component({
  selector: 'app-consolidated-cash',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    DateOnlyPickerComponent,
    Message,
    Panel,
    TableModule,
  ],
  templateUrl: './consolidated-cash.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsolidatedCashPage {
  private readonly api = inject(CollectionTreasury);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly report = signal<ConsolidatedCashView | null>(null);
  protected readonly form = new FormGroup({
    from: new FormControl(this.firstDay(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    to: new FormControl(todayDateOnly(), { nonNullable: true, validators: [Validators.required] }),
  });
  constructor() {
    this.load();
  }
  protected load(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    const { from, to } = this.form.getRawValue();
    if (this.form.invalid || from > to) {
      this.error.set('El período no es válido.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .getConsolidatedCash(from, to)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (report) => this.report.set(report),
        error: () =>
          this.error.set(
            'No fue posible generar el consolidado. Usa un período máximo de doce meses.',
          ),
      });
  }
  private firstDay(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
}

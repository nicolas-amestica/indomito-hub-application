import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import type { CollectionAlertView } from '../../interfaces/collection-treasury.interface';
import { CollectionTreasury } from '../../services/collection-treasury';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';

@Component({
  selector: 'app-collection-alerts',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    DateOnlyPickerComponent,
    Message,
    Panel,
    TableModule,
  ],
  templateUrl: './collection-alerts.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionAlertsPage {
  private readonly api = inject(CollectionTreasury);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tripId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly asOf = new FormControl(todayDateOnly(), {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly view = signal<CollectionAlertView | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  constructor() {
    if (this.tripId) this.load();
    else this.error.set('No se identificó la gira.');
  }
  protected load(): void {
    if (this.busy() || this.asOf.invalid) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .getAlerts(this.tripId, this.asOf.value)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (value) => this.view.set(value),
        error: () => this.error.set('No fue posible calcular las alertas de cobranza.'),
      });
  }
}

import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import type { RefundRow } from '../../interfaces/collection-treasury.interface';
import { CollectionTreasury } from '../../services/collection-treasury';

@Component({
  selector: 'app-trip-refunds',
  imports: [CurrencyPipe, RouterLink, ButtonDirective, Message, Panel, TableModule],
  templateUrl: './trip-refunds.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripRefundsPage {
  private readonly api = inject(CollectionTreasury);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tripId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly rows = signal<RefundRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  constructor() {
    if (this.tripId) this.load();
    else this.error.set('No se identificó la gira.');
  }
  protected refresh(): void {
    if (!this.busy()) this.load();
  }
  private load(cursor = '', accumulated: RefundRow[] = []): void {
    this.busy.set(true);
    this.error.set('');
    this.api
      .listRefunds(this.tripId, cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const all = [...accumulated, ...page.items];
          if (page.nextCursor) this.load(page.nextCursor, all);
          else {
            this.rows.set(all);
            this.busy.set(false);
          }
        },
        error: () => {
          this.busy.set(false);
          this.error.set('No fue posible cargar las devoluciones de la gira.');
        },
      });
  }
}

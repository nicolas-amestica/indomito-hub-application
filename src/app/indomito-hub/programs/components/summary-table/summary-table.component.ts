import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  type TrackByFunction,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Table } from 'primeng/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { ClpAmountPipe } from '../../../../shared/formatting/clp-amount.pipe';
import { exchangeRateOriginLabel } from '../../fn/fn-exchange-rate-source';
import type {
  EffectiveRates,
  ExchangeRateSource,
  ProgramTotals,
  SummaryRow,
} from '../../interfaces/program.interface';
import { FallbackRatesNoticeComponent } from '../fallback-rates-notice/fallback-rates-notice.component';

/** Umbral fijado por el diseño para limitar la cantidad de filas en el DOM. */
export const SUMMARY_VIRTUAL_SCROLL_THRESHOLD = 50;

/** Tabla presentacional del detalle calculado y sus totales. */
@Component({
  selector: 'app-summary-table',
  imports: [
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    InputText,
    Table,
    ClpAmountPipe,
    FallbackRatesNoticeComponent,
  ],
  templateUrl: './summary-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryTableComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = input.required<SummaryRow[]>();
  readonly totalRowCount = input.required<number>();
  readonly totals = input.required<ProgramTotals>();
  readonly effectiveRates = input.required<EffectiveRates>();
  readonly snapshotDate = input.required<string>();
  readonly snapshotSource = input.required<ExchangeRateSource>();
  readonly snapshotIsFallback = input.required<boolean>();
  readonly fallbackDate = input<string | null>(null);
  readonly embedded = input(false);

  readonly searchChanged = output<string>();

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly virtualScrollThreshold = SUMMARY_VIRTUAL_SCROLL_THRESHOLD;
  protected readonly exchangeRateOriginLabel = exchangeRateOriginLabel;
  protected readonly trackRow: TrackByFunction<SummaryRow> = (_index, row) => row.key;

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.searchChanged.emit(term));
  }
}

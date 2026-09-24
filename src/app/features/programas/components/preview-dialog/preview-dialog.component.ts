import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { ProgressSpinner } from 'primeng/progressspinner';

import { ClpAmountPipe } from '../../../../shared/formatting/clp-amount.pipe';
import { CHARGE_TYPE_LABELS } from '../../constants/charge-types';
import { exchangeRateSourceLabel } from '../../formatting/exchange-rate-source';
import type { EffectiveRates, Program } from '../../interfaces/program.interface';
import { FallbackRatesNoticeComponent } from '../fallback-rates-notice/fallback-rates-notice.component';

/** Previsualización presentacional construida exclusivamente desde el estado local. */
@Component({
  selector: 'app-preview-dialog',
  imports: [
    DatePipe,
    DecimalPipe,
    ButtonDirective,
    Dialog,
    ProgressSpinner,
    ClpAmountPipe,
    FallbackRatesNoticeComponent,
  ],
  templateUrl: './preview-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewDialogComponent {
  readonly visible = model(false);
  readonly program = input.required<Program>();
  readonly effectiveRates = input.required<EffectiveRates>();
  readonly fallbackDate = input<string | null>(null);
  readonly busy = input(false);
  readonly favoriteAvailable = input(true);

  readonly excelRequested = output<void>();
  readonly pdfRequested = output<void>();
  readonly favoriteRequested = output<void>();

  protected readonly chargeTypeLabels = CHARGE_TYPE_LABELS;
  protected readonly exchangeRateSourceLabel = exchangeRateSourceLabel;
}

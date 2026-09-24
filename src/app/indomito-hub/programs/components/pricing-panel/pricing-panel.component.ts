import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, type AbstractControl, type FormGroup } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Select } from 'primeng/select';

import { FIELD_LIMITS } from '../../constants/field-limits';
import type { PricingControls } from '../../types/program-form.types';
import type { ExchangeSnapshot } from '../../interfaces/program.interface';
import { buildNumericOptions } from '../../fn/fn-build-numeric-options';
import type { ForeignCurrency } from '../../types/foreign-currency.type';

/** Panel presentacional de resguardos, utilidad y recargo. */
@Component({
  selector: 'app-pricing-panel',
  imports: [DecimalPipe, ReactiveFormsModule, Select],
  templateUrl: './pricing-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingPanelComponent {
  readonly group = input.required<FormGroup<PricingControls>>();
  readonly snapshot = input<ExchangeSnapshot | null>(null);
  readonly belowUtilityFloor = input(false);
  readonly minimumUtilityRate = input<number | null>(null);
  readonly embedded = input(false);

  protected readonly usdIncreaseOptions = buildNumericOptions(
    FIELD_LIMITS.usdIncreaseCLP.min,
    FIELD_LIMITS.usdIncreaseCLP.max,
    FIELD_LIMITS.usdIncreaseCLP.step,
    'CLP',
  );
  protected readonly brlIncreaseOptions = buildNumericOptions(
    FIELD_LIMITS.brlIncreaseCLP.min,
    FIELD_LIMITS.brlIncreaseCLP.max,
    FIELD_LIMITS.brlIncreaseCLP.step,
    'CLP',
  );
  protected readonly percentageOptions = buildNumericOptions(
    FIELD_LIMITS.utilityRate.min,
    FIELD_LIMITS.utilityRate.max,
    FIELD_LIMITS.utilityRate.step,
    '%',
  );

  protected dailyRate(currency: ForeignCurrency): number | null {
    const snapshot = this.snapshot();
    if (snapshot === null) return null;
    return currency === 'USD' ? snapshot.usdToClp : snapshot.brlToClp;
  }

  protected effectiveRate(currency: ForeignCurrency): number | null {
    const daily = this.dailyRate(currency);
    const increase =
      currency === 'USD'
        ? this.group().controls.usdIncreaseCLP.value
        : this.group().controls.brlIncreaseCLP.value;
    return daily === null || increase === null ? null : daily + increase;
  }

  protected guardPercentage(currency: ForeignCurrency): number | null {
    const daily = this.dailyRate(currency);
    const effective = this.effectiveRate(currency);
    if (daily === null || daily <= 0 || effective === null) return null;
    return ((effective - daily) / daily) * 100;
  }

  protected selectAccessibility(control: AbstractControl, errorId: string) {
    const invalid = control.touched && control.invalid;
    return {
      label: {
        'aria-invalid': invalid ? 'true' : null,
        'aria-describedby': invalid ? errorId : null,
      },
    };
  }
}

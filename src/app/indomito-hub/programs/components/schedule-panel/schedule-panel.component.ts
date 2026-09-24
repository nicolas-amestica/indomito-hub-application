import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, type FormGroup } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';

import { FIELD_LIMITS } from '../../constants/field-limits';
import type { ScheduleControls } from '../../types/program-form.types';

/** Panel presentacional de duración y cantidades del programa. */
@Component({
  selector: 'app-schedule-panel',
  imports: [ReactiveFormsModule, InputNumber],
  templateUrl: './schedule-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulePanelComponent {
  readonly group = input.required<FormGroup<ScheduleControls>>();
  readonly payingPassengers = input<number | null>(null);
  readonly nightsExceedDays = input(false);
  readonly embedded = input(false);

  protected readonly limits = FIELD_LIMITS;

  protected payingPassengersHasError(): boolean {
    const controls = this.group().controls;
    return (
      (controls.totalPassengers.touched || controls.freePassengers.touched) &&
      this.group().hasError('payingPassenger')
    );
  }

  protected nightsDescription(): string | undefined {
    const nights = this.group().controls.totalNights;
    const ids: string[] = [];
    if (nights.touched && nights.invalid) ids.push('program-total-nights-error');
    if (this.nightsExceedDays()) ids.push('program-nights-warning');
    return ids.length > 0 ? ids.join(' ') : undefined;
  }
}

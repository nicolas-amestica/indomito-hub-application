import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, type FormGroup } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';

import { FIELD_LIMITS } from '../../constants/field-limits';
import type { ScheduleControls } from '../../forms/program-form.types';

/** Panel presentacional de fechas y cantidades del programa. */
@Component({
  selector: 'app-schedule-panel',
  imports: [ReactiveFormsModule, InputNumber, InputText],
  templateUrl: './schedule-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulePanelComponent {
  readonly group = input.required<FormGroup<ScheduleControls>>();
  readonly totalDays = input(0);
  readonly payingPassengers = input<number | null>(null);
  readonly nightsExceedDays = input(false);
  readonly embedded = input(false);

  protected readonly limits = FIELD_LIMITS;

  protected rangeHasError(errorKey: string): boolean {
    const controls = this.group().controls;
    return (
      (controls.startDate.touched || controls.endDate.touched) && this.group().hasError(errorKey)
    );
  }

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

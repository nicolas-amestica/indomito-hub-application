import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, type AbstractControl } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { CURRENCY_OPTIONS } from '../../constants/currency-options';
import { FIELD_LIMITS } from '../../constants/field-limits';
import { addCrew as appendCrew, removeCrew as deleteCrew } from '../../forms/program-form.builder';
import type { CrewArray, CrewRowGroup } from '../../forms/program-form.types';

/** Panel presentacional de la lista dinámica de tripulantes. */
@Component({
  selector: 'app-crew-panel',
  imports: [ButtonDirective, InputNumber, InputText, ReactiveFormsModule, Select],
  templateUrl: './crew-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrewPanelComponent {
  readonly crews = input.required<CrewArray>();
  readonly embedded = input(false);

  protected readonly currencies = CURRENCY_OPTIONS;
  protected readonly limits = FIELD_LIMITS;

  protected add(): void {
    appendCrew(this.crews());
  }

  protected remove(index: number): void {
    deleteCrew(this.crews(), index);
  }

  protected priceInvalid(row: CrewRowGroup): boolean {
    return (
      row.controls.dailyPrice.touched &&
      (row.controls.dailyPrice.invalid || row.hasError('clpIntegerPrice'))
    );
  }

  protected priceDescription(row: CrewRowGroup, index: number): string | undefined {
    return this.priceInvalid(row) ? `crew-${index}-daily-price-error` : undefined;
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

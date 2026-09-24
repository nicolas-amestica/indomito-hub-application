import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule, type AbstractControl } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { CHARGE_TYPE_OPTIONS } from '../../constants/charge-types';
import { CURRENCY_OPTIONS } from '../../constants/currency-options';
import { FIELD_LIMITS } from '../../constants/field-limits';
import {
  addService as appendService,
  duplicateService as cloneService,
  removeService as deleteService,
} from '../../forms/program-form.builder';
import type { ServiceArray, ServiceRowGroup } from '../../types/program-form.types';

/** Panel presentacional de la lista dinámica de servicios. */
@Component({
  selector: 'app-services-panel',
  imports: [ButtonDirective, InputNumber, InputText, ReactiveFormsModule, Select],
  templateUrl: './services-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPanelComponent {
  readonly services = input.required<ServiceArray>();
  readonly embedded = input(false);

  protected readonly chargeTypes = [...CHARGE_TYPE_OPTIONS];
  protected readonly currencies = CURRENCY_OPTIONS;
  protected readonly limits = FIELD_LIMITS;

  protected add(): void {
    appendService(this.services());
  }

  protected duplicate(index: number): void {
    cloneService(this.services(), index);
  }

  protected remove(index: number): void {
    deleteService(this.services(), index);
  }

  protected priceInvalid(row: ServiceRowGroup): boolean {
    return (
      row.controls.unitPrice.touched &&
      (row.controls.unitPrice.invalid || row.hasError('clpIntegerPrice'))
    );
  }

  protected priceDescription(row: ServiceRowGroup, index: number): string | undefined {
    return this.priceInvalid(row) ? `service-${index}-unit-price-error` : undefined;
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

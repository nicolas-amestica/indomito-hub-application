import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ReactiveFormsModule, type AbstractControl } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';
import {
  AutoComplete,
  type AutoCompleteCompleteEvent,
  type AutoCompleteSelectEvent,
} from 'primeng/autocomplete';

import { CHARGE_TYPE_OPTIONS } from '../../constants/charge-types';
import { CURRENCY_OPTIONS } from '../../constants/currency-options';
import { FIELD_LIMITS } from '../../constants/field-limits';
import {
  addService as appendService,
  duplicateService as cloneService,
  removeService as deleteService,
} from '../../forms/program-form.builder';
import type { ServiceArray, ServiceRowGroup } from '../../types/program-form.types';
import type { ServiceCatalogItem } from '../../../../shared/service-catalog/interfaces/service-catalog.interface';

/** Panel presentacional de la lista dinámica de servicios. */
@Component({
  selector: 'app-services-panel',
  imports: [AutoComplete, ButtonDirective, InputNumber, ReactiveFormsModule, Select],
  templateUrl: './services-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPanelComponent {
  readonly services = input.required<ServiceArray>();
  readonly embedded = input(false);
  readonly revision = input(0);
  readonly catalog = input<readonly ServiceCatalogItem[]>([]);
  protected readonly suggestions = signal<ServiceCatalogItem[]>([]);

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

  protected searchCatalog(event: AutoCompleteCompleteEvent): void {
    const query = event.query.trim().toLocaleLowerCase('es-CL');
    this.suggestions.set(
      query.length < 2
        ? []
        : this.catalog().filter((item) => item.glosa.toLocaleLowerCase('es-CL').includes(query)),
    );
  }

  protected selectCatalogItem(row: ServiceRowGroup, event: AutoCompleteSelectEvent): void {
    const item = event.value as ServiceCatalogItem;
    row.patchValue({
      name: item.glosa,
      chargeType: item.chargeType,
      unitPrice: item.price,
      currency: item.currency,
    });
    row.markAsDirty();
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
      overlay: { class: 'border-line/55!' },
      listContainer: { class: 'border-line/55!' },
    };
  }
}

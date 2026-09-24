import { ChangeDetectionStrategy, Component, effect, input } from '@angular/core';
import { ReactiveFormsModule, type AbstractControl, type FormGroup } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';

import type { GeneralsControls } from '../../types/program-form.types';
import type { CatalogOption, DestinationOption } from '../../interfaces/catalog.interface';

/**
 * Seccion presentacional de datos generales.
 *
 * El container entrega tanto el grupo como los catalogos. El panel no conoce
 * servicios ni stores, de modo que solo traduce estado de formulario a una UI
 * accesible y puede probarse de forma aislada.
 */
@Component({
  selector: 'app-general-data-panel',
  imports: [ReactiveFormsModule, InputText, Select, Textarea],
  templateUrl: './general-data-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralDataPanelComponent {
  readonly group = input.required<FormGroup<GeneralsControls>>();
  readonly plans = input.required<CatalogOption[]>();
  readonly seasons = input.required<CatalogOption[]>();
  readonly destinations = input.required<DestinationOption[]>();
  readonly loading = input(false);
  readonly embedded = input(false);

  constructor() {
    effect(() => {
      const controls = this.group().controls;
      const selectControls = [controls.plan, controls.season, controls.destination];

      for (const control of selectControls) {
        if (this.loading()) {
          control.disable({ emitEvent: false });
        } else {
          control.enable({ emitEvent: false });
        }
      }
    });
  }

  /** Lleva la relacion con el error hasta el elemento combobox interno de PrimeNG. */
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

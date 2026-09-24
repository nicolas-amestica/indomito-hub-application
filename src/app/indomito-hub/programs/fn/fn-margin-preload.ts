import type { FormGroup } from '@angular/forms';

import type { MarginDefaults } from '../interfaces/catalog.interface';
import type { PricingControls } from '../types/program-form.types';

/**
 * Precarga los parámetros de margen definidos por la empresa.
 *
 * Solo escribe valores: no reemplaza ni elimina validadores. Si el catálogo no
 * declara margen, los cuatro controles conservan `null` y siguen siendo
 * obligatorios. Tampoco sobrescribe una decisión que el usuario ya comenzó a
 * editar mientras la respuesta del catálogo estaba en tránsito.
 */
export function applyMarginDefaults(
  pricing: FormGroup<PricingControls>,
  margin: MarginDefaults | undefined,
): void {
  if (margin === undefined || pricing.dirty) return;

  pricing.patchValue(
    {
      usdIncreaseCLP: margin.usdIncreaseCLP,
      brlIncreaseCLP: margin.brlIncreaseCLP,
      utilityRate: margin.utilityRate,
      rechargeRate: margin.rechargeRate,
    },
    { emitEvent: false },
  );
}

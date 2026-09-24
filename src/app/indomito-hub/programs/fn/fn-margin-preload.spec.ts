import fc from 'fast-check';
import { arbCatalogSettings } from '../calculation/__arbitraries__';
import { buildProgramForm } from '../forms/program-form.builder';
import { applyMarginDefaults } from './fn-margin-preload';

const MARGIN = {
  usdIncreaseCLP: 50,
  brlIncreaseCLP: 10,
  utilityRate: 20,
  rechargeRate: 5,
  minUtilityRate: 10,
} as const;

describe('applyMarginDefaults', () => {
  it('aplica los cuatro valores sin copiar el piso de utilidad al formulario', () => {
    const pricing = buildProgramForm().controls.pricing;

    applyMarginDefaults(pricing, MARGIN);

    expect(pricing.getRawValue()).toEqual({
      usdIncreaseCLP: 50,
      brlIncreaseCLP: 10,
      utilityRate: 20,
      rechargeRate: 5,
    });
    expect(pricing.get('minUtilityRate')).toBeNull();
  });

  it('conserva los controles obligatorios y pristine después de precargar', () => {
    const pricing = buildProgramForm().controls.pricing;

    applyMarginDefaults(pricing, MARGIN);

    expect(pricing.valid).toBe(true);
    expect(pricing.pristine).toBe(true);

    pricing.controls.utilityRate.setValue(null);
    expect(pricing.controls.utilityRate.hasError('required')).toBe(true);
  });

  it('no emite valueChanges por la precarga', () => {
    const pricing = buildProgramForm().controls.pricing;
    const values: unknown[] = [];
    const subscription = pricing.valueChanges.subscribe((value) => values.push(value));

    applyMarginDefaults(pricing, MARGIN);

    expect(values).toEqual([]);
    subscription.unsubscribe();
  });

  it('deja los campos vacíos, obligatorios e inválidos cuando no hay margen', () => {
    const pricing = buildProgramForm().controls.pricing;

    applyMarginDefaults(pricing, undefined);

    expect(pricing.getRawValue()).toEqual({
      usdIncreaseCLP: null,
      brlIncreaseCLP: null,
      utilityRate: null,
      rechargeRate: null,
    });
    expect(pricing.invalid).toBe(true);
    expect(pricing.controls.utilityRate.hasError('required')).toBe(true);
  });

  it('no sobrescribe valores cuando el usuario ya modificó el grupo', () => {
    const pricing = buildProgramForm().controls.pricing;
    pricing.patchValue({ utilityRate: 12, rechargeRate: 3 });
    pricing.markAsDirty();

    applyMarginDefaults(pricing, MARGIN);

    expect(pricing.controls.utilityRate.value).toBe(12);
    expect(pricing.controls.rechargeRate.value).toBe(3);
    expect(pricing.controls.usdIncreaseCLP.value).toBeNull();
    expect(pricing.controls.brlIncreaseCLP.value).toBeNull();
  });

  it('Feature: program-form, Property 23: La precarga de margen no relaja la obligatoriedad y el piso de utilidad no bloquea', () => {
    fc.assert(
      fc.property(arbCatalogSettings(), ({ margin }) => {
        const pricing = buildProgramForm(() => 'row-id').controls.pricing;

        applyMarginDefaults(pricing, margin);

        const controls = [
          pricing.controls.usdIncreaseCLP,
          pricing.controls.brlIncreaseCLP,
          pricing.controls.utilityRate,
          pricing.controls.rechargeRate,
        ];
        for (const control of controls) {
          const preloadedValue = control.value;
          control.setValue(null);
          expect(control.hasError('required')).toBe(true);
          control.setValue(preloadedValue);
        }

        if (margin === undefined) {
          expect(pricing.invalid).toBe(true);
          return;
        }

        // `minUtilityRate` es política de advertencia: incluso cuando la utilidad
        // precargada está bajo el piso, no agrega un validador al formulario.
        expect(pricing.valid).toBe(true);
        if (margin.utilityRate < margin.minUtilityRate) {
          expect(pricing.controls.utilityRate.valid).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

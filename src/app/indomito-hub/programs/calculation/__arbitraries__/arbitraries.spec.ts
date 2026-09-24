/**
 * Verificación de los generadores de `fast-check`.
 *
 * Un generador que no alcanza sus fronteras vuelve inútil a la propiedad que lo
 * consume, y lo hace en silencio: el test pasa. Estas pruebas son la única forma
 * de que ese silencio no ocurra. Comprueban dos cosas por generador:
 *
 * - **Cobertura**: cada frontera declarada en la tabla "Generadores" de
 *   `design.md` aparece en una muestra acotada.
 * - **Validez**: todo valor generado es alcanzable desde el formulario. Un
 *   generador que produzca entradas imposibles reporta contraejemplos falsos.
 *
 * La semilla es fija a propósito: un test de cobertura que dependa del azar
 * convierte una laguna del generador en un fallo intermitente.
 */

import fc from 'fast-check';
import { CHARGE_TYPE_LABELS } from '../../constants/charge-types';
import { FIELD_LIMITS } from '../../constants/field-limits';
import { MAX_SCENARIOS } from '../../constants/scenario-defaults';
import type { ChargeType } from '../../interfaces/program.interface';
import {
  DAY_DEPENDENT_CHARGE_TYPES,
  MAX_GENERATED_CREWS,
  MAX_GENERATED_SERVICES,
  addDaysIso,
  arbCalculationInput,
  arbCatalogSettings,
  arbDateRange,
  arbDocumentIdSample,
  arbMutatedDocumentId,
  arbPricing,
  arbProgramName,
  arbScenarioCase,
  arbSchedule,
  arbService,
  arbZeroNetInput,
  isValidCpf,
  isValidRut,
  isoRangeContains,
} from './index';

const SEED = 20_260_214;

/** Muestra determinista de un generador. */
function sample<T>(arbitrary: fc.Arbitrary<T>, numRuns = 3000): T[] {
  return fc.sample(arbitrary, { numRuns, seed: SEED });
}

/** Falla con el nombre de la frontera cuando ningún valor generado la alcanza. */
function expectReaches<T>(values: T[], boundary: string, predicate: (value: T) => boolean): void {
  expect(values.some(predicate), `ningun valor generado alcanza: ${boundary}`).toBe(true);
}

/** Falla con el nombre del invariante indicando el primer valor que lo rompe. */
function expectAlways<T>(values: T[], invariant: string, predicate: (value: T) => boolean): void {
  const offender = values.find((value) => !predicate(value));
  expect(offender, `un valor generado rompe el invariante "${invariant}"`).toBeUndefined();
}

describe('arbSchedule', () => {
  const schedules = sample(arbSchedule());

  it('alcanza las fronteras del calendario', () => {
    expectReaches(schedules, '1 dia', (s) => s.totalDays === 1);
    expectReaches(schedules, '100 dias', (s) => s.totalDays === FIELD_LIMITS.totalDays.max);
    expectReaches(
      schedules,
      'cruce de anio',
      (s) => s.startDate.slice(0, 4) !== s.endDate.slice(0, 4),
    );
    expectReaches(schedules, '29 de febrero', (s) =>
      isoRangeContains(s.startDate, s.endDate, '2024-02-29'),
    );
  });

  it('alcanza las fronteras de pasajeros', () => {
    expectReaches(schedules, '1 pasajero', (s) => s.totalPassengers === 1);
    expectReaches(
      schedules,
      '100 pasajeros',
      (s) => s.totalPassengers === FIELD_LIMITS.totalPassengers.max,
    );
    expectReaches(schedules, 'sin liberados', (s) => s.freePassengers === 0);
    expectReaches(
      schedules,
      'liberados en totalPassengers - 1',
      (s) => s.totalPassengers > 1 && s.freePassengers === s.totalPassengers - 1,
    );
  });

  it('solo genera calendarios que el formulario puede producir', () => {
    expectAlways(
      schedules,
      'endDate cuenta ambos extremos del rango',
      (s) => s.endDate === addDaysIso(s.startDate, s.totalDays - 1),
    );
    expectAlways(
      schedules,
      'siempre queda al menos un pagante',
      (s) => s.freePassengers < s.totalPassengers,
    );
    expectAlways(
      schedules,
      'las noches respetan su rango',
      (s) =>
        s.totalNights >= FIELD_LIMITS.totalNights.min &&
        s.totalNights <= FIELD_LIMITS.totalNights.max,
    );
  });
});

describe('arbDateRange', () => {
  const ranges = sample(arbDateRange());

  it('alcanza el rango de un dia, el de cien y los invertidos', () => {
    expectReaches(ranges, 'rango de un solo dia', (r) => r.offsetDays === 0);
    expectReaches(
      ranges,
      'rango de cien dias',
      (r) => r.offsetDays === FIELD_LIMITS.totalDays.max - 1,
    );
    expectReaches(ranges, 'invertido por un dia', (r) => r.offsetDays === -1);
    expectReaches(ranges, 'invertido al maximo', (r) => r.offsetDays < -1);
  });

  it('el desplazamiento describe el rango generado', () => {
    expectAlways(
      ranges,
      'endDate es startDate desplazado por offsetDays',
      (r) => r.endDate === addDaysIso(r.startDate, r.offsetDays),
    );
  });
});

describe('arbPricing', () => {
  const pricings = sample(arbPricing());

  it('alcanza los incrementos en 0 y en su maximo', () => {
    expectReaches(pricings, 'incremento USD en 0', (p) => p.usdIncreaseCLP === 0);
    expectReaches(
      pricings,
      'incremento USD en su maximo',
      (p) => p.usdIncreaseCLP === FIELD_LIMITS.usdIncreaseCLP.max,
    );
    expectReaches(pricings, 'incremento BRL en 0', (p) => p.brlIncreaseCLP === 0);
    expectReaches(
      pricings,
      'incremento BRL en su maximo',
      (p) => p.brlIncreaseCLP === FIELD_LIMITS.brlIncreaseCLP.max,
    );
  });

  it('alcanza la utilidad y el recargo en 0 y en 100', () => {
    expectReaches(pricings, 'utilidad en 0', (p) => p.utilityRate === 0);
    expectReaches(pricings, 'utilidad en 100', (p) => p.utilityRate === 100);
    expectReaches(pricings, 'recargo en 0', (p) => p.rechargeRate === 0);
    expectReaches(pricings, 'recargo en 100', (p) => p.rechargeRate === 100);
  });

  it('los incrementos son multiplos de su paso', () => {
    expectAlways(
      pricings,
      'el incremento USD es multiplo de su paso',
      (p) => p.usdIncreaseCLP % FIELD_LIMITS.usdIncreaseCLP.step === 0,
    );
    expectAlways(
      pricings,
      'el incremento BRL es multiplo de su paso',
      (p) => p.brlIncreaseCLP % FIELD_LIMITS.brlIncreaseCLP.step === 0,
    );
  });
});

describe('arbService', () => {
  const services = sample(arbService());
  const chargeTypes = Object.keys(CHARGE_TYPE_LABELS) as ChargeType[];

  it('alcanza los cinco tipos de cobro y las tres monedas', () => {
    for (const chargeType of chargeTypes) {
      expectReaches(services, `tipo de cobro ${chargeType}`, (s) => s.chargeType === chargeType);
    }
    for (const currency of ['CLP', 'USD', 'BRL'] as const) {
      expectReaches(services, `moneda ${currency}`, (s) => s.currency === currency);
    }
  });

  it('alcanza el precio en el minimo y en el maximo', () => {
    expectReaches(
      services,
      'precio en el minimo del rango',
      (s) => s.unitPrice === FIELD_LIMITS.itemPrice.min,
    );
    expectReaches(
      services,
      'precio minimo en CLP',
      (s) => s.currency === 'CLP' && s.unitPrice === 1,
    );
    expectReaches(
      services,
      'precio en el maximo del rango',
      (s) => s.unitPrice === FIELD_LIMITS.itemPrice.max,
    );
  });

  it('respeta las reglas del control de precio', () => {
    expectAlways(
      services,
      'un precio en CLP es entero',
      (s) => s.currency !== 'CLP' || Number.isInteger(s.unitPrice),
    );
    expectAlways(
      services,
      'el precio esta dentro de su rango',
      (s) => s.unitPrice >= FIELD_LIMITS.itemPrice.min && s.unitPrice <= FIELD_LIMITS.itemPrice.max,
    );
    expectAlways(services, 'el nombre no esta vacio', (s) => s.name.length > 0);
  });
});

describe('arbCalculationInput', () => {
  const inputs = sample(arbCalculationInput());

  it('alcanza las listas vacias, la fila unica y los tamanios maximos', () => {
    expectReaches(
      inputs,
      'sin tripulantes ni servicios',
      (i) => i.crews.length + i.services.length === 0,
    );
    expectReaches(
      inputs,
      'sin tripulantes, con servicios',
      (i) => i.crews.length === 0 && i.services.length > 0,
    );
    expectReaches(
      inputs,
      'sin servicios, con tripulantes',
      (i) => i.services.length === 0 && i.crews.length > 0,
    );
    expectReaches(inputs, 'una sola fila', (i) => i.crews.length + i.services.length === 1);
    expectReaches(inputs, '20 tripulantes', (i) => i.crews.length === MAX_GENERATED_CREWS);
    expectReaches(inputs, '100 servicios', (i) => i.services.length === MAX_GENERATED_SERVICES);
    // Los dos maximos a la vez, no solo cada uno por su lado: es el programa con
    // 120 filas, donde el error de redondeo de todas las conversiones se acumula.
    expectReaches(
      inputs,
      '20 tripulantes y 100 servicios en el mismo programa',
      (i) => i.crews.length === MAX_GENERATED_CREWS && i.services.length === MAX_GENERATED_SERVICES,
    );
  });

  it('alcanza el caso de neto 0 en sus dos formas', () => {
    expectReaches(
      inputs,
      'neto 0 por programa sin filas',
      (i) => i.crews.length + i.services.length === 0,
    );
    expectReaches(
      inputs,
      'neto 0 por rango de fechas invertido',
      (i) => i.schedule.totalDays === 0 && i.crews.length + i.services.length > 0,
    );
  });

  it('las tasas efectivas son la tasa del dia mas el incremento', () => {
    expectAlways(inputs, 'el CLP no se altera', (i) => i.rates.CLP === 1);
    expectAlways(
      inputs,
      'las tasas de divisa superan a su incremento',
      (i) => i.rates.USD > i.pricing.usdIncreaseCLP && i.rates.BRL > i.pricing.brlIncreaseCLP,
    );
  });
});

describe('arbZeroNetInput', () => {
  const inputs = sample(arbZeroNetInput(), 1000);

  it('todo valor generado tiene neto 0 por construccion', () => {
    expectAlways(
      inputs,
      'sin filas, o con todos los montos base anulados por totalDays en 0',
      (i) => {
        if (i.crews.length + i.services.length === 0) return true;
        return (
          i.schedule.totalDays === 0 &&
          i.services.every((service) => DAY_DEPENDENT_CHARGE_TYPES.includes(service.chargeType))
        );
      },
    );
  });

  it('alcanza las dos formas de llegar a neto 0', () => {
    expectReaches(inputs, 'programa sin filas', (i) => i.crews.length + i.services.length === 0);
    expectReaches(
      inputs,
      'programa con filas y totalDays en 0',
      (i) => i.schedule.totalDays === 0 && i.crews.length + i.services.length > 0,
    );
  });
});

describe('arbDocumentId', () => {
  const documents = sample(arbDocumentIdSample());

  it('alcanza los tres documentos, con y sin formato', () => {
    for (const kind of ['rut', 'dni', 'cpf'] as const) {
      expectReaches(documents, `documento ${kind}`, (d) => d.kind === kind);
      expectReaches(
        documents,
        `${kind} con formato`,
        (d) => d.kind === kind && d.formatted && d.value.includes('.'),
      );
      expectReaches(
        documents,
        `${kind} sin formato`,
        (d) => d.kind === kind && !d.formatted && !d.value.includes('.'),
      );
    }
  });

  it('los RUT y los CPF son validos por construccion, con y sin formato', () => {
    expectAlways(
      documents,
      'un RUT generado tiene el digito verificador que le corresponde',
      (d) => d.kind !== 'rut' || (isValidRut(d.value) && isValidRut(d.raw)),
    );
    expectAlways(
      documents,
      'un CPF generado tiene los dos digitos verificadores que le corresponden',
      (d) => d.kind !== 'cpf' || (isValidCpf(d.value) && isValidCpf(d.raw)),
    );
  });

  it('un DNI generado tiene siete u ocho digitos y no lleva verificador', () => {
    expectAlways(
      documents,
      'el DNI son solo digitos',
      (d) => d.kind !== 'dni' || /^\d{7,8}$/.test(d.raw),
    );
  });
});

describe('arbMutatedDocumentId', () => {
  const mutated = sample(arbMutatedDocumentId(), 1000);

  it('todo documento mutado es invalido', () => {
    expectAlways(
      mutated,
      'la mutacion rompe el digito verificador',
      (value) => !isValidRut(value) && !isValidCpf(value),
    );
  });

  it('alcanza mutaciones de RUT y de CPF', () => {
    expectReaches(mutated, 'RUT mutado', (value) => value.includes('-'));
    expectReaches(mutated, 'CPF mutado', (value) => /^\d{11}$/.test(value));
  });
});

describe('arbProgramName', () => {
  const names = sample(arbProgramName());
  const trimmedLengths = names.map((name) => name.trim().length);

  it('alcanza la cadena vacia y la de solo espacios', () => {
    expectReaches(names, 'cadena vacia', (name) => name === '');
    expectReaches(names, 'solo espacios', (name) => name !== '' && name.trim() === '');
  });

  it('alcanza los largos recortados de 2, 3 y 4', () => {
    for (const length of [2, 3, 4]) {
      expect(trimmedLengths, `ningun nombre recortado mide ${length}`).toContain(length);
    }
  });

  it('alcanza tildes y ñ', () => {
    expectReaches(names, 'nombre con tilde', (name) => /[áéíóúÁÉÍÓÚ]/.test(name));
    expectReaches(names, 'nombre con ñ', (name) => /[ñÑ]/.test(name));
  });

  it('alcanza nombres con espacios que recortar cambia', () => {
    expectReaches(
      names,
      'nombre con espacios sobrantes en los extremos',
      (name) => name.trim().length > 0 && name.trim() !== name,
    );
  });
});

describe('arbScenarioOffsets', () => {
  const cases = sample(arbScenarioCase());

  it('alcanza la lista vacia, la de un desplazamiento y las de mas de cuatro', () => {
    expectReaches(cases, 'lista vacia', (c) => c.offsets.length === 0);
    expectReaches(cases, 'un solo desplazamiento', (c) => c.offsets.length === 1);
    expectReaches(cases, 'mas de cuatro desplazamientos', (c) => c.offsets.length > MAX_SCENARIOS);
  });

  it('alcanza desplazamientos repetidos', () => {
    expectReaches(
      cases,
      'desplazamientos repetidos',
      (c) => new Set(c.offsets).size < c.offsets.length,
    );
  });

  it('alcanza negativos de magnitud mayor que los pasajeros del programa', () => {
    expectReaches(cases, 'negativo que excede a los pasajeros del programa', (c) =>
      c.offsets.some((offset) => offset <= -c.schedule.totalPassengers),
    );
  });

  it('alcanza varios negativos que colapsan al mismo escenario minimo', () => {
    expectReaches(
      cases,
      'dos o mas negativos que exceden a los pasajeros del programa',
      (c) => c.offsets.filter((offset) => offset <= -c.schedule.totalPassengers).length >= 2,
    );
  });
});

describe('arbCatalogSettings', () => {
  const settings = sample(arbCatalogSettings());

  it('alcanza las cuatro combinaciones de presencia de sus campos opcionales', () => {
    expectReaches(
      settings,
      'con margin y con scenarioOffsets',
      (s) => s.margin !== undefined && s.scenarioOffsets !== undefined,
    );
    expectReaches(
      settings,
      'con margin y sin scenarioOffsets',
      (s) => s.margin !== undefined && s.scenarioOffsets === undefined,
    );
    expectReaches(
      settings,
      'sin margin y con scenarioOffsets',
      (s) => s.margin === undefined && s.scenarioOffsets !== undefined,
    );
    expectReaches(
      settings,
      'sin margin ni scenarioOffsets',
      (s) => s.margin === undefined && s.scenarioOffsets === undefined,
    );
  });

  it('omite la clave ausente en vez de asignarle undefined', () => {
    expectAlways(
      settings,
      'margin ausente significa clave ausente',
      (s) => s.margin !== undefined || !('margin' in s),
    );
    expectAlways(
      settings,
      'scenarioOffsets ausente significa clave ausente',
      (s) => s.scenarioOffsets !== undefined || !('scenarioOffsets' in s),
    );
  });

  it('alcanza la utilidad en 0 y por debajo del piso', () => {
    expectReaches(settings, 'utilidad en 0', (s) => s.margin?.utilityRate === 0);
    expectReaches(
      settings,
      'utilidad bajo el piso de politica',
      (s) => s.margin !== undefined && s.margin.utilityRate < s.margin.minUtilityRate,
    );
    expectReaches(
      settings,
      'utilidad que cumple el piso de politica',
      (s) => s.margin !== undefined && s.margin.utilityRate >= s.margin.minUtilityRate,
    );
  });
});

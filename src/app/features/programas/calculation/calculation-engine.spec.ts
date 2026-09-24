/**
 * Ejemplos y casos límite del motor de cálculo.
 *
 * Las propiedades 1 a 4 cubren el espacio completo de fechas, incrementos y
 * cantidades. Estos ejemplos cubren lo que una propiedad no deja legible: la
 * frontera concreta con su valor esperado escrito a mano, que es lo que permite
 * leer el archivo y saber qué se espera del cálculo sin ejecutar nada.
 */

import type { ExchangeSnapshot } from '../interfaces/program.interface';
import type { CalculationInput, PricingInput } from './calculation.types';
import {
  buildEffectiveRates,
  calculateProgram,
  derivePayingPassengers,
  deriveTotalDays,
} from './calculation-engine';

/** Snapshot con tasas redondas, para que la aritmética del ejemplo se lea sola. */
const SNAPSHOT: ExchangeSnapshot = {
  date: '2026-02-14',
  usdToClp: 1000,
  brlToClp: 180,
  isFallback: false,
  source: 'banco-central',
};

/** Parámetros de precio con los dos incrementos en su valor por defecto de prueba. */
const PRICING: PricingInput = {
  usdIncreaseCLP: 60,
  brlIncreaseCLP: 20,
  utilityRate: 15,
  rechargeRate: 5,
};

/** Entrada mínima que los casos límite especializan sin repetir el contrato completo. */
const MINIMAL_PROGRAM: CalculationInput = {
  schedule: {
    totalDays: 1,
    totalNights: 1,
    totalPassengers: 1,
    freePassengers: 0,
  },
  pricing: {
    usdIncreaseCLP: 0,
    brlIncreaseCLP: 0,
    utilityRate: 0,
    rechargeRate: 0,
  },
  rates: { CLP: 1, USD: 1, BRL: 1 },
  crews: [],
  services: [],
};

describe('buildEffectiveRates', () => {
  it('suma el incremento a la tasa del dia de cada divisa', () => {
    const rates = buildEffectiveRates(PRICING, SNAPSHOT);

    expect(rates.USD).toBe(1060);
    expect(rates.BRL).toBe(200);
  });

  it('deja el CLP en 1 cualquiera sea el incremento', () => {
    const withoutIncrease = buildEffectiveRates(
      { ...PRICING, usdIncreaseCLP: 0, brlIncreaseCLP: 0 },
      SNAPSHOT,
    );
    const withMaxIncrease = buildEffectiveRates(
      { ...PRICING, usdIncreaseCLP: 200, brlIncreaseCLP: 40 },
      SNAPSHOT,
    );

    expect(withoutIncrease.CLP).toBe(1);
    expect(withMaxIncrease.CLP).toBe(1);
  });

  it('con incrementos en 0 devuelve la tasa del dia sin alterar', () => {
    const rates = buildEffectiveRates(
      { ...PRICING, usdIncreaseCLP: 0, brlIncreaseCLP: 0 },
      SNAPSHOT,
    );

    expect(rates.USD).toBe(SNAPSHOT.usdToClp);
    expect(rates.BRL).toBe(SNAPSHOT.brlToClp);
  });

  it('no altera el snapshot ni los parametros de precio', () => {
    buildEffectiveRates(PRICING, SNAPSHOT);

    expect(SNAPSHOT).toEqual({
      date: '2026-02-14',
      usdToClp: 1000,
      brlToClp: 180,
      isFallback: false,
      source: 'banco-central',
    });
    expect(PRICING.usdIncreaseCLP).toBe(60);
  });
});

describe('deriveTotalDays', () => {
  it('cuenta un dia cuando el rango empieza y termina el mismo dia', () => {
    expect(deriveTotalDays('2026-03-10', '2026-03-10')).toBe(1);
  });

  it('cuenta ambos extremos del rango', () => {
    expect(deriveTotalDays('2026-03-10', '2026-03-12')).toBe(3);
  });

  it('cruza el 29 de febrero de un anio bisiesto', () => {
    expect(deriveTotalDays('2024-02-28', '2024-03-01')).toBe(3);
  });

  it('cruza el mismo tramo de un anio comun, que no tiene 29 de febrero', () => {
    expect(deriveTotalDays('2023-02-28', '2023-03-01')).toBe(2);
  });

  it('cruza el fin de anio', () => {
    expect(deriveTotalDays('2025-12-30', '2026-01-02')).toBe(4);
  });

  it('cuenta 100 dias en el maximo permitido', () => {
    expect(deriveTotalDays('2026-01-01', '2026-04-10')).toBe(100);
  });

  it('no se altera con el cambio de horario de verano de Chile', () => {
    // En 2026 el horario de verano de Chile termina el 5 de abril: ese dia tiene
    // 25 horas en la zona local. Un rango que lo cruza sigue siendo de 3 dias.
    expect(deriveTotalDays('2026-04-04', '2026-04-06')).toBe(3);
  });

  it('anula los dias cuando el rango esta invertido por un dia', () => {
    expect(deriveTotalDays('2026-03-11', '2026-03-10')).toBe(0);
  });

  it('anula los dias cuando el rango esta invertido por meses', () => {
    expect(deriveTotalDays('2026-06-01', '2026-01-01')).toBe(0);
  });

  it('devuelve 0 cuando el rango esta incompleto', () => {
    expect(deriveTotalDays('2026-03-10', null)).toBe(0);
    expect(deriveTotalDays(null, '2026-03-10')).toBe(0);
    expect(deriveTotalDays(null, null)).toBe(0);
    expect(deriveTotalDays('', '')).toBe(0);
  });

  it('devuelve 0 ante una fecha inexistente o mal formada', () => {
    expect(deriveTotalDays('2023-02-29', '2023-03-05')).toBe(0);
    expect(deriveTotalDays('2026-13-01', '2026-13-05')).toBe(0);
    expect(deriveTotalDays('10-03-2026', '12-03-2026')).toBe(0);
    expect(deriveTotalDays('2026-03-10T00:00:00Z', '2026-03-12')).toBe(0);
  });
});

describe('derivePayingPassengers', () => {
  it('resta los liberados del total', () => {
    expect(derivePayingPassengers(30, 2)).toBe(28);
  });

  it('devuelve el total cuando no hay liberados', () => {
    expect(derivePayingPassengers(30, 0)).toBe(30);
  });

  it('mantiene el piso de 1 cuando los liberados igualan al total', () => {
    expect(derivePayingPassengers(1, 1)).toBe(1);
    expect(derivePayingPassengers(30, 30)).toBe(1);
  });

  it('mantiene el piso de 1 cuando los liberados superan al total', () => {
    expect(derivePayingPassengers(10, 99)).toBe(1);
  });

  it('deja un pagante en el maximo de liberados permitido por el formulario', () => {
    expect(derivePayingPassengers(100, 99)).toBe(1);
  });
});

describe('calculateProgram — casos límite', () => {
  it('mantiene todos los montos finitos cuando el neto es cero', () => {
    const result = calculateProgram(MINIMAL_PROGRAM);

    expect(result.rows).toEqual([]);
    expect(result.netRaw).toBe(0);
    expect(Object.values(result.totals).every(Number.isFinite)).toBe(true);
    expect(result.totals).toEqual({
      subtotalCLP: 0,
      subtotalUSD: 0,
      subtotalBRL: 0,
      netCLP: 0,
      vatCLP: 0,
      crewWithholdingCLP: 0,
      utilityCLP: 0,
      netWithUtilityCLP: 0,
      netWithUtilityPerPassengerCLP: 0,
      rechargeCLP: 0,
      totalCLP: 0,
      totalPerPassengerCLP: 0,
    });
  });

  it('desglosa el IVA de servicios y la retención bruta de tripulación sin alterar el total', () => {
    const result = calculateProgram({
      ...MINIMAL_PROGRAM,
      crews: [
        {
          name: 'Guía',
          documentId: '17137440-5',
          dailyPrice: 100_000,
          currency: 'CLP',
        },
      ],
      services: [
        {
          name: 'Traslado',
          chargeType: 'fixed',
          unitPrice: 119_000,
          currency: 'CLP',
        },
      ],
    });

    expect(result.totals.vatCLP).toBe(19_000);
    expect(result.totals.crewWithholdingCLP).toBe(15_250);
    expect(result.totals.totalCLP).toBe(219_000);
  });

  it('reparte un programa de un pasajero sin cambiar su total', () => {
    const result = calculateProgram({
      ...MINIMAL_PROGRAM,
      services: [
        {
          name: 'Traslado privado',
          chargeType: 'fixed',
          unitPrice: 10_000,
          currency: 'CLP',
        },
      ],
    });

    expect(result.totals.totalCLP).toBe(10_000);
    expect(result.totals.totalPerPassengerCLP).toBe(10_000);
  });

  it('con el máximo de liberados conserva un solo pagante como divisor', () => {
    const result = calculateProgram({
      ...MINIMAL_PROGRAM,
      schedule: {
        ...MINIMAL_PROGRAM.schedule,
        totalPassengers: 100,
        freePassengers: 99,
      },
      services: [
        {
          name: 'Entrada',
          chargeType: 'per_passenger',
          unitPrice: 10,
          currency: 'CLP',
        },
      ],
    });

    expect(derivePayingPassengers(100, 99)).toBe(1);
    expect(result.totals.totalCLP).toBe(1_000);
    expect(result.totals.totalPerPassengerCLP).toBe(1_000);
  });

  it('conserva los precios mínimos antes del redondeo final a CLP', () => {
    const result = calculateProgram({
      ...MINIMAL_PROGRAM,
      crews: [
        {
          name: 'Guía',
          documentId: '12345678',
          dailyPrice: 0.01,
          currency: 'USD',
        },
      ],
      services: [
        {
          name: 'Seguro',
          chargeType: 'fixed',
          unitPrice: 0.01,
          currency: 'BRL',
        },
      ],
    });

    expect(result.rows.map((row) => row.baseAmount)).toEqual([0.01, 0.01]);
    expect(result.netRaw).toBe(0.02);
    expect(result.totals.netCLP).toBe(0);
    expect(result.totals.totalPerPassengerCLP).toBe(0);
  });
});

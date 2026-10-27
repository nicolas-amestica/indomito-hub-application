/**
 * Ejemplos de las seis fórmulas de monto base y del redondeo centralizado.
 *
 * Los tests de propiedad de esta misma tabla son la tarea 4.2. Acá se fijan los
 * casos concretos: uno por fórmula, más las fronteras donde el multiplicador
 * cambia de naturaleza (rango invertido y programa sin liberados pagantes).
 */

import { describe, expect, it } from 'vitest';
import type { CrewInput, ScheduleInput, ServiceInput } from '../types/calculation.types';
import { baseAmount, isCrewItem } from './charge-type';
import { ceil, round } from './rounding';

/** Calendario de referencia: 5 días, 4 noches, 30 pasajeros con 2 liberados. */
const schedule: ScheduleInput = {
  totalDays: 5,
  totalNights: 4,
  totalPassengers: 30,
  freePassengers: 2,
};

function service(chargeType: ServiceInput['chargeType'], unitPrice: number): ServiceInput {
  return { name: 'Servicio', chargeType, unitPrice, currency: 'CLP' };
}

function crew(dailyPrice: number): CrewInput {
  return { name: 'Guía', documentId: '11.111.111-1', dailyPrice, currency: 'CLP' };
}

describe('baseAmount', () => {
  it('cobra el tripulante por día de programa', () => {
    expect(baseAmount(crew(50_000), schedule)).toBe(250_000);
  });

  it('deja el precio unitario intacto en el tipo fixed', () => {
    expect(baseAmount(service('fixed', 800_000), schedule)).toBe(800_000);
  });

  it('multiplica por los días en el tipo per_day', () => {
    expect(baseAmount(service('per_day', 20_000), schedule)).toBe(100_000);
  });

  it('multiplica por los pasajeros en el tipo per_passenger', () => {
    expect(baseAmount(service('per_passenger', 12_000), schedule)).toBe(360_000);
  });

  it('multiplica por pasajeros y noches en el tipo per_passenger_night', () => {
    expect(baseAmount(service('per_passenger_night', 15_000), schedule)).toBe(1_800_000);
  });

  it('multiplica por pasajeros y días en el tipo per_passenger_day', () => {
    expect(baseAmount(service('per_passenger_day', 3_000), schedule)).toBe(450_000);
  });

  it('cuenta los pasajeros liberados en el multiplicador', () => {
    // 30 pasajeros, no 28 pagantes: el liberado igual ocupa una cama.
    const conLiberados = baseAmount(service('per_passenger', 10_000), schedule);
    const sinLiberados = baseAmount(service('per_passenger', 10_000), {
      ...schedule,
      freePassengers: 0,
    });
    expect(conLiberados).toBe(300_000);
    expect(conLiberados).toBe(sinLiberados);
  });

  it('anula los tipos que dependen de días cuando el rango está invertido', () => {
    const invertido: ScheduleInput = { ...schedule, totalDays: 0, totalNights: 0 };
    expect(baseAmount(crew(50_000), invertido)).toBe(0);
    expect(baseAmount(service('per_day', 20_000), invertido)).toBe(0);
    expect(baseAmount(service('per_passenger_day', 3_000), invertido)).toBe(0);
    expect(baseAmount(service('per_passenger_night', 15_000), invertido)).toBe(0);
    // El fixed y el per_passenger no dependen del calendario.
    expect(baseAmount(service('fixed', 800_000), invertido)).toBe(800_000);
    expect(baseAmount(service('per_passenger', 12_000), invertido)).toBe(360_000);
  });

  it('conserva los decimales del precio unitario, sin redondear', () => {
    expect(baseAmount(service('per_passenger', 12.5), schedule)).toBe(375);
    expect(baseAmount(crew(0.01), schedule)).toBeCloseTo(0.05, 10);
  });
});

describe('isCrewItem', () => {
  it('distingue el tripulante del servicio', () => {
    expect(isCrewItem(crew(1))).toBe(true);
    expect(isCrewItem(service('fixed', 1))).toBe(false);
  });
});

describe('round y ceil', () => {
  it('round va al entero más cercano y los empates suben', () => {
    expect(round(1234.4)).toBe(1234);
    expect(round(1234.5)).toBe(1235);
    expect(round(1234.6)).toBe(1235);
    expect(round(0)).toBe(0);
  });

  it('ceil sube cualquier fracción', () => {
    expect(ceil(1234.000001)).toBe(1235);
    expect(ceil(1234)).toBe(1234);
    expect(ceil(0)).toBe(0);
  });
});

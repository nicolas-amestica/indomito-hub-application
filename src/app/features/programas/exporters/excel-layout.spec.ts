import fc from 'fast-check';

import { arbCalculationInput } from '../calculation/__arbitraries__';
import { calculateProgram } from '../calculation/calculation-engine';
import type { CalculationInput } from '../calculation/calculation.types';
import type { Program, SummaryRow } from '../interfaces/program.interface';
import {
  EXCEL_DETAIL_HEADERS,
  buildExcelFileName,
  buildExcelLayout,
  type ExcelCell,
  type ExcelRow,
} from './excel-layout';

const NUM_RUNS = 100;
const EXPORTED_AT = new Date('2027-04-12T15:30:00.000Z');

describe('buildExcelLayout', () => {
  it('Feature: program-form, Property 31: El Excel exporta el programa completo', () => {
    fc.assert(
      fc.property(arbCalculationInput(), (input) => {
        const calculation = calculateProgram(input);
        const program = programFrom(input, calculation.rows, calculation.totals);
        const layout = buildExcelLayout(program, calculation.rows, EXPORTED_AT);
        const detailHeaderIndex = layout.rows.findIndex(
          (row) => JSON.stringify(cellValues(row)) === JSON.stringify(EXCEL_DETAIL_HEADERS),
        );

        expect(detailHeaderIndex).toBeGreaterThanOrEqual(0);
        const exportedDetail = layout.rows.slice(
          detailHeaderIndex + 1,
          detailHeaderIndex + 1 + calculation.rows.length,
        );
        expect(exportedDetail.map(cellValues)).toEqual(
          calculation.rows.map((row) => [
            row.name,
            row.typeLabel,
            row.currency,
            row.effectiveRate,
            row.unitPrice,
            row.baseAmount,
            row.amountCLP,
          ]),
        );

        expect(metadataValue(layout.rows, 'Fecha de exportación')).toEqual(EXPORTED_AT);
        expect(metadataValue(layout.rows, 'Pasajeros')).toBe(input.schedule.totalPassengers);
        expect(metadataValue(layout.rows, 'Pasajeros liberados')).toBe(
          input.schedule.freePassengers,
        );
        expect(metadataValue(layout.rows, 'Tasa del día USD')).toBe(
          program.pricing.exchange.usdToClp,
        );
        expect(metadataValue(layout.rows, 'Tasa efectiva USD')).toBe(input.rates.USD);
        expect(metadataValue(layout.rows, 'Tasa del día BRL')).toBe(
          program.pricing.exchange.brlToClp,
        );
        expect(metadataValue(layout.rows, 'Tasa efectiva BRL')).toBe(input.rates.BRL);

        expect(metadataValue(layout.rows, 'Subtotal CLP')).toBe(calculation.totals.subtotalCLP);
        expect(metadataValue(layout.rows, 'Subtotal USD')).toBe(calculation.totals.subtotalUSD);
        expect(metadataValue(layout.rows, 'Subtotal BRL')).toBe(calculation.totals.subtotalBRL);
        expect(metadataValue(layout.rows, 'Neto')).toBe(calculation.totals.netCLP);
        expect(metadataValue(layout.rows, 'Utilidad')).toBe(calculation.totals.utilityCLP);
        expect(metadataValue(layout.rows, 'Recargo')).toBe(calculation.totals.rechargeCLP);
        expect(metadataValue(layout.rows, 'Total programa')).toBe(calculation.totals.totalCLP);
        expect(metadataValue(layout.rows, 'Total por persona')).toBe(
          calculation.totals.totalPerPassengerCLP,
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Feature: program-form, Property 32: El nombre del archivo es derivable y válido', () => {
    const safeName = fc
      .array(fc.constantFrom(...' ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyzáéíóú'), {
        minLength: 1,
        maxLength: 80,
      })
      .map((characters) => characters.join(''))
      .filter((name) => name.trim().length > 0);

    fc.assert(
      fc.property(safeName, (name) => {
        expect(buildExcelFileName(name)).toBe(
          `${name.trim().toLocaleLowerCase('es-CL').replace(/\s+/gu, '_')}.xlsx`,
        );
      }),
      { numRuns: NUM_RUNS },
    );

    fc.assert(
      fc.property(fc.string({ maxLength: 180 }), (name) => {
        const fileName = buildExcelFileName(name);

        expect(fileName).toBe(buildExcelFileName(name));
        expect(fileName).toBe(fileName.toLocaleLowerCase('es-CL'));
        expect(fileName).toMatch(/\.xlsx$/u);
        expect(fileName).not.toMatch(/[<>:"/\\|?*\u0000-\u001f\s]/u);
        expect(fileName.length).toBeLessThanOrEqual(105);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

function programFrom(
  input: CalculationInput,
  rows: readonly SummaryRow[],
  totals: Program['totals'],
): Program {
  return {
    generals: {
      name: 'Gira Brasil 2027',
      description: 'Programa generado para el test de propiedad',
      plan: { id: 'plan-1', display: 'Gira de estudio' },
      season: { id: '2027', display: '2027' },
      destination: { id: 'brx', display: 'Brasil' },
      departureCity: 'Santiago',
    },
    schedule: {
      ...input.schedule,
      payingPassengers: Math.max(1, input.schedule.totalPassengers - input.schedule.freePassengers),
    },
    pricing: {
      ...input.pricing,
      exchange: {
        date: '2027-04-12',
        usdToClp: input.rates.USD - input.pricing.usdIncreaseCLP,
        brlToClp: input.rates.BRL - input.pricing.brlIncreaseCLP,
        isFallback: false,
      },
    },
    crews: input.crews.map((crew, index) => ({
      ...crew,
      baseAmount: rows[index].baseAmount,
      amountCLP: rows[index].amountCLP,
    })),
    services: input.services.map((service, index) => ({
      ...service,
      baseAmount: rows[input.crews.length + index].baseAmount,
      amountCLP: rows[input.crews.length + index].amountCLP,
    })),
    totals,
  };
}

function cellValues(row: ExcelRow): Array<ExcelCell['value'] | null> {
  return row.map((cell) => cell?.value ?? null);
}

function metadataValue(rows: readonly ExcelRow[], label: string): ExcelCell['value'] {
  const row = rows.find((candidate) => candidate[0]?.value === label);
  return row?.[1]?.value;
}

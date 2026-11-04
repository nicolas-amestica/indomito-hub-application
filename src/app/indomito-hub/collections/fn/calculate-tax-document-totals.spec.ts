import { describe, expect, it } from 'vitest';
import { TAX_DOCUMENT_UNIT_OPTIONS } from '../constants/tax-document-unit-options.constant';
import { calculateTaxDocumentTotals } from './calculate-tax-document-totals';

describe('calculateTaxDocumentTotals', () => {
  it('separa neto, IVA y exento sin alterar el total bruto', () => {
    expect(
      calculateTaxDocumentTotals([
        { quantity: 8, unitPrice: 1590, exempt: false },
        { quantity: 2, unitPrice: 1000, exempt: true },
      ]),
    ).toEqual({ net: 10689, vat: 2031, exempt: 2000, gross: 14720 });
  });

  it('mueve una linea entre afecto y exento al cambiar el checkbox', () => {
    const affected = calculateTaxDocumentTotals([{ quantity: 1, unitPrice: 1190, exempt: false }]);
    const exempt = calculateTaxDocumentTotals([{ quantity: 1, unitPrice: 1190, exempt: true }]);

    expect(affected).toEqual({ net: 1000, vat: 190, exempt: 0, gross: 1190 });
    expect(exempt).toEqual({ net: 0, vat: 0, exempt: 1190, gross: 1190 });
  });

  it('mantiene las unidades dentro del limite de cuatro bytes del API', () => {
    expect(TAX_DOCUMENT_UNIT_OPTIONS.every(({ value }) => new TextEncoder().encode(value).length <= 4)).toBe(true);
  });
});

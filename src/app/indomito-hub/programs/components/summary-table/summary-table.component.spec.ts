import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { LOCALE_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import fc from 'fast-check';
import { Table } from 'primeng/table';

import type { EffectiveRates, ProgramTotals, SummaryRow } from '../../interfaces/program.interface';
import { SUMMARY_VIRTUAL_SCROLL_THRESHOLD, SummaryTableComponent } from './summary-table.component';

registerLocaleData(localeEsCl);

const TOTALS: ProgramTotals = {
  subtotalCLP: 315_000,
  subtotalUSD: 1_650,
  subtotalBRL: 200,
  netCLP: 2_010_600,
  vatCLP: 263_445,
  crewWithholdingCLP: 48_038,
  vatRate: 19,
  crewWithholdingRate: 15.25,
  utilityCLP: 402_120,
  netWithUtilityCLP: 2_412_720,
  netWithUtilityPerPassengerCLP: 86_169,
  rechargeCLP: 120_636,
  totalCLP: 2_533_356,
  totalPerPassengerCLP: 90_477,
};

const RATES: EffectiveRates = { CLP: 1, USD: 1_000, BRL: 228 };

function summaryRow(index: number, kind: SummaryRow['kind'] = 'service'): SummaryRow {
  return {
    key: `${kind}:row-${index}`,
    name: kind === 'crew' ? `Tripulante ${index}` : `Servicio ${index}`,
    kind,
    chargeType: kind === 'crew' ? null : 'per_passenger_night',
    typeLabel: kind === 'crew' ? 'Tripulación' : 'Por pasajero por noche',
    currency: kind === 'crew' ? 'CLP' : 'USD',
    effectiveRate: kind === 'crew' ? 1 : 1_000,
    unitPrice: kind === 'crew' ? 45_000 : 55,
    baseAmount: kind === 'crew' ? 315_000 : 1_650,
    amountCLP: kind === 'crew' ? 315_000 : 1_650_000,
    passengerIndependent: kind === 'crew',
  };
}

describe('SummaryTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryTableComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CL' }],
    }).compileComponents();
  });

  function createTable(rows: SummaryRow[]) {
    const fixture = TestBed.createComponent(SummaryTableComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('totalRowCount', rows.length);
    fixture.componentRef.setInput('totals', TOTALS);
    fixture.componentRef.setInput('effectiveRates', RATES);
    fixture.componentRef.setInput('snapshotDate', '2027-03-01');
    fixture.componentRef.setInput('snapshotSource', 'banco-central');
    fixture.componentRef.setInput('snapshotIsFallback', false);
    fixture.componentRef.setInput('fallbackDate', null);
    return fixture;
  }

  it('muestra las siete columnas, las etiquetas con texto y los once montos del pie', async () => {
    const fixture = createTable([summaryRow(0, 'crew'), summaryRow(1)]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(
      [...host.querySelectorAll('th[scope="col"]')].map((cell) => cell.textContent?.trim()),
    ).toEqual([
      'Nombre',
      'Tipo',
      'Moneda',
      'Tasa efectiva',
      'Precio unitario',
      'Monto base',
      'Monto en CLP',
    ]);
    expect(host.querySelectorAll('[data-summary-row]')).toHaveLength(2);
    expect(host.textContent).toContain('Tripulación');
    expect(host.textContent).toContain('Por pasajero por noche');
    expect(host.querySelectorAll('[aria-label="Totales de la cotización"] > div')).toHaveLength(11);
    expect(host.textContent).toContain('2.533.356 CLP');
    expect(host.textContent).toContain('Banco Central de Chile');
    expect(host.textContent).toContain('IVA incluido');
    expect(host.textContent).toContain(
      'Los montos de IVA y retención informados abajo ya están incluidos en los precios.',
    );
    expect(host.textContent).toContain('IVA incluido (19%)');
    expect(host.textContent).toContain('263.445 CLP');
    expect(host.textContent).toContain('Retención tripulación (15,25%)');
    expect(host.textContent).toContain('48.038 CLP');
  });

  it('emite el texto de búsqueda solo después de 150 ms', async () => {
    const fixture = createTable([summaryRow(0)]);
    await fixture.whenStable();
    const emitted: string[] = [];
    fixture.componentInstance.searchChanged.subscribe((term) => emitted.push(term));
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#program-summary-search',
    )!;

    vi.useFakeTimers();
    try {
      input.value = 'hotel';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(149);
      expect(emitted).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(emitted).toEqual(['hotel']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('activa el virtual scrolling a partir de cincuenta filas', async () => {
    const rows = Array.from({ length: SUMMARY_VIRTUAL_SCROLL_THRESHOLD }, (_, index) =>
      summaryRow(index),
    );
    const fixture = createTable(rows);
    await fixture.whenStable();
    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;

    expect(table.virtualScroll()).toBe(true);
    expect(table.dataKey()).toBe('key');
    expect(table.rowTrackBy()(0, rows[0])).toBe(rows[0].key);
  });

  it('muestra el aviso de respaldo junto a las tasas cuando corresponde', async () => {
    const fixture = createTable([summaryRow(0)]);
    fixture.componentRef.setInput('fallbackDate', '2027-02-28');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-fallback-rates-notice')).not.toBeNull();
    expect(host.textContent).toContain('28 de febrero de 2027');
  });

  it('Feature: program-form, Property 28: La tabla se muestra exactamente cuando hay algún ítem válido', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { maxLength: 4 }),
        fc.array(fc.boolean(), { maxLength: 4 }),
        async (crewValidity, serviceValidity) => {
          const validRows = [
            ...crewValidity.flatMap((valid, index) => (valid ? [summaryRow(index, 'crew')] : [])),
            ...serviceValidity.flatMap((valid, index) =>
              valid ? [summaryRow(crewValidity.length + index)] : [],
            ),
          ];
          const fixture = createTable(validRows);
          await fixture.whenStable();
          const host = fixture.nativeElement as HTMLElement;

          expect(host.querySelector('[aria-labelledby="summary-heading"]') !== null).toBe(
            validRows.length > 0,
          );
          expect(host.querySelectorAll('[data-summary-row]')).toHaveLength(validRows.length);
          fixture.destroy();
        },
      ),
      { numRuns: 100 },
    );
  });
});

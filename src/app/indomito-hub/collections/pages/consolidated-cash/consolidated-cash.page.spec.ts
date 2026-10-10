import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CollectionTreasury } from '../../services/collection-treasury';
import { ConsolidatedCashPage } from './consolidated-cash.page';

describe('ConsolidatedCashPage', () => {
  it('no presenta el neto del periodo como saldo bancario', async () => {
    const api = {
      getConsolidatedCash: vi.fn().mockReturnValue(
        of({
          from: '2026-10-01',
          to: '2026-10-05',
          inflows: 10000,
          outflows: 3000,
          net: 7000,
          actualFees: 100,
          trips: [],
        }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [ConsolidatedCashPage],
      providers: [provideRouter([]), { provide: CollectionTreasury, useValue: api }],
    });
    const fixture = TestBed.createComponent(ConsolidatedCashPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no es el saldo de la cuenta bancaria');
    expect(fixture.nativeElement.textContent).toContain('Neto del período');
  });
});

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionSettlement } from '../../interfaces/collection-treasury.interface';
import { CollectionTreasury } from '../../services/collection-treasury';
import { TripTreasuryPage } from './trip-treasury.page';

describe('TripTreasuryPage', () => {
  const settlement: CollectionSettlement = {
    paymentReference: 'khipu:payment',
    tripId: 'trip',
    amount: 20000,
    settledGross: 0,
    actualFees: 0,
    version: 1,
  };
  const api = { listSettlements: vi.fn(), getCash: vi.fn(), reconcile: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    api.listSettlements.mockReturnValue(of({ items: [settlement] }));
    api.getCash.mockReturnValue(
      of({
        period: { opening: 0, inflows: 0, outflows: 0, closing: 0 },
        inTransit: 20000,
        actualFees: 0,
        position: {
          receivable: 30000,
          depositReceivable: 0,
          installmentReceivable: 30000,
          appliedReceipts: 0,
          unappliedReceipts: 0,
          discounts: 0,
          cancelled: 0,
          refundPayable: 5000,
          refunded: 0,
        },
        suppliers: { committedPending: 12000, refundExpected: 2000 },
        events: [],
      }),
    );
    TestBed.configureTestingModule({
      imports: [TripTreasuryPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'trip' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: CollectionTreasury, useValue: api },
      ],
    });
  });

  it('muestra fondos Khipu en transito separados de caja', async () => {
    const fixture = TestBed.createComponent(TripTreasuryPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('En tránsito Khipu');
    expect(fixture.nativeElement.textContent).toMatch(/\$20[.,]000/);
  });

  it('reintenta exactamente la misma conciliacion ante respuesta incierta', async () => {
    api.reconcile.mockReturnValueOnce(throwError(() => new Error('timeout')));
    const fixture = TestBed.createComponent(TripTreasuryPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      select(value: CollectionSettlement): void;
      reconcile(): void;
      reconcileForm: { setValue(value: unknown): void };
    };
    component.select(settlement);
    component.reconcileForm.setValue({
      gross: 20000,
      fee: 500,
      bankReference: 'CARTOLA-001',
      effectiveDate: '2026-10-05',
      reason: 'Cartola bancaria revisada',
      reviewed: true,
    });
    component.reconcile();
    const first = api.reconcile.mock.calls[0][2];
    expect(first.commandId).toHaveLength(26);
    api.reconcile.mockReturnValueOnce(
      of({ ...settlement, settledGross: 20000, actualFees: 500, version: 2 }),
    );
    component.reconcile();
    expect(api.reconcile.mock.calls[1][2]).toEqual(first);
  });
});

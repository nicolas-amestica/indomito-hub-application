import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CollectionTreasury } from '../../services/collection-treasury';
import { TripRefundsPage } from './trip-refunds.page';

describe('TripRefundsPage', () => {
  it('distingue aprobación de salida bancaria y enlaza la cuenta exacta', async () => {
    const api = {
      listRefunds: vi
        .fn()
        .mockReturnValue(
          of({
            items: [
              {
                accountId: 'account',
                name: 'Ana',
                document: '12.345.678-5',
                active: false,
                paidInstallments: 100000,
                withdrawalRefundApproved: 80000,
                unappliedReceived: 0,
                unappliedRefundApproved: 0,
                refunded: 30000,
                refundPayable: 50000,
                version: 4,
              },
            ],
          }),
        ),
    };
    TestBed.configureTestingModule({
      imports: [TripRefundsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'trip' }) } },
        },
        { provide: CollectionTreasury, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(TripRefundsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'una aprobación tampoco equivale a dinero devuelto',
    );
    expect(
      fixture.nativeElement.querySelector(
        'a[href="/cobranza/cuentas/account"]',
      ) as HTMLAnchorElement | null,
    ).not.toBeNull();
  });
});

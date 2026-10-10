import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionTreasury } from '../../services/collection-treasury';
import { TripSuppliersPage } from './trip-suppliers.page';

describe('TripSuppliersPage', () => {
  const api = { listSuppliers: vi.fn(), operateSupplier: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    api.listSuppliers.mockReturnValue(of({ items: [] }));
    TestBed.configureTestingModule({
      imports: [TripSuppliersPage],
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
  it('explica que un compromiso no es efectivo bancario', async () => {
    const fixture = TestBed.createComponent(TripSuppliersPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no cambia la caja');
  });
  it('congela un alta incierta y reintenta el mismo comando', async () => {
    api.operateSupplier.mockReturnValueOnce(throwError(() => new Error('timeout')));
    const fixture = TestBed.createComponent(TripSuppliersPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      begin(value: 'CREATE'): void;
      save(): void;
      form: { setValue(value: unknown): void };
    };
    component.begin('CREATE');
    component.form.setValue({
      name: 'Hotel Andes',
      service: 'Alojamiento',
      committed: 100000,
      refundAgreed: 0,
      amount: 0,
      reference: '',
      effectiveDate: '2026-10-05',
      annexId: '',
      reason: 'Contrato revisado',
      reviewed: true,
    });
    component.save();
    const first = api.operateSupplier.mock.calls[0];
    api.operateSupplier.mockReturnValueOnce(of({}));
    component.save();
    expect(api.operateSupplier.mock.calls[1][1]).toBe(first[1]);
    expect(api.operateSupplier.mock.calls[1][2]).toEqual(first[2]);
  });
});

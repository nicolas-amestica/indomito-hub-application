import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionAnnexes } from '../../services/collection-annexes';
import { CollectionGroupDiscounts } from '../../services/collection-group-discounts';
import { GroupDiscountPage } from './group-discount.page';

describe('GroupDiscountPage', () => {
  const discounts = { create: vi.fn(), get: vi.fn(), approve: vi.fn() };
  const annexes = { roster: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    annexes.roster.mockReturnValue(
      of({
        items: [
          {
            accountId: 'a',
            participantId: 'p',
            name: 'Pasajero A',
            document: '11.111.111-1',
            active: true,
            free: false,
            version: 1,
          },
        ],
        closed: false,
      }),
    );
    TestBed.configureTestingModule({
      imports: [GroupDiscountPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'trip-1' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        { provide: CollectionAnnexes, useValue: annexes },
        { provide: CollectionGroupDiscounts, useValue: discounts },
      ],
    });
  });
  it('crea borrador sin modificar y exige una segunda aprobación', async () => {
    discounts.create.mockReturnValue(
      of({
        id: 'internal',
        tripId: 'trip-1',
        status: 'DRAFT',
        basisPoints: 1000,
        expected: 1,
        prepared: 1,
        applied: 0,
        amount: 90000,
      }),
    );
    discounts.approve.mockReturnValue(
      of({
        id: 'internal',
        tripId: 'trip-1',
        status: 'APPLIED',
        basisPoints: 1000,
        expected: 1,
        prepared: 1,
        applied: 1,
        amount: 90000,
      }),
    );
    const fixture = TestBed.createComponent(GroupDiscountPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      draftForm: { setValue(v: unknown): void };
      approvalForm: { setValue(v: unknown): void };
    };
    component.draftForm.setValue({
      all: true,
      accountIds: [],
      percentage: 10,
      reason: 'Ayuda extraordinaria aprobada',
      reviewed: true,
    });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(discounts.create).toHaveBeenCalledTimes(1);
    expect(discounts.approve).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Aprobación irreversible');
    component.approvalForm.setValue({
      reason: 'Impacto y beneficiarios revisados',
      reviewed: true,
    });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(discounts.approve).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('se publicó completamente');
  });
});

import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CollectionAnnexes } from '../../services/collection-annexes';
import { AnnexFormPage } from './annex-form.page';

describe('AnnexFormPage', () => {
  it('shows only active accounts as withdrawal candidates', async () => {
    const api = {
      roster: vi.fn().mockReturnValue(
        of({
          items: [
            {
              accountId: 'active',
              participantId: 'p1',
              name: 'Pasajero activo',
              document: '1-9',
              active: true,
              free: false,
              version: 2,
            },
            {
              accountId: 'inactive',
              participantId: 'p2',
              name: 'Pasajero inactivo',
              document: '2-7',
              active: false,
              free: false,
              version: 3,
            },
          ],
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [AnnexFormPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: CollectionAnnexes, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'trip' })),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AnnexFormPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const withdrawals =
      root.querySelector('[aria-labelledby="withdrawals-title"]')?.textContent ?? '';
    const history =
      root.querySelector('[aria-labelledby="participation-history-title"]')?.textContent ?? '';
    expect(api.roster).toHaveBeenCalledWith('trip', '');
    expect(withdrawals).toContain('Pasajero activo');
    expect(withdrawals).not.toContain('Pasajero inactivo');
    expect(history).toContain('Pasajero activo');
    expect(history).toContain('Pasajero inactivo');
  });

  it('offers and executes the explicit migration for a historical roster', async () => {
    const api = {
      roster: vi
        .fn()
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })))
        .mockReturnValue(of({ items: [] })),
      migrateRoster: vi
        .fn()
        .mockReturnValue(of({ tripId: 'trip', status: 'APPLIED', prepared: 2, expected: 2 })),
    };
    await TestBed.configureTestingModule({
      imports: [AnnexFormPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: CollectionAnnexes, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'trip' })),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AnnexFormPage);
    await fixture.whenStable();
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (element) => element.textContent?.includes('Preparar nómina'),
    );
    expect(button).toBeTruthy();
    button?.click();
    await fixture.whenStable();
    expect(api.migrateRoster).toHaveBeenCalledWith(
      'trip',
      'trip',
      'Habilitar proyección administrativa de nómina histórica',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pasajeros que salen');
  });

  it('closes the roster explicitly while keeping financial operations available', async () => {
    const api = {
      roster: vi
        .fn()
        .mockReturnValueOnce(of({ items: [], closed: false }))
        .mockReturnValue(
          of({
            items: [],
            closed: true,
            closedAt: '2026-10-05T14:00:00Z',
            closeReason: 'Nómina definitiva revisada',
          }),
        ),
      closeRoster: vi.fn().mockReturnValue(of({ tripId: 'trip', closed: true })),
    };
    await TestBed.configureTestingModule({
      imports: [AnnexFormPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: CollectionAnnexes, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'trip' })),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AnnexFormPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      closureReason: { setValue(value: string): void };
      closureReviewed: { set(value: boolean): void };
      closeRoster(): Promise<void>;
    };
    component.closureReason.setValue('Nómina definitiva revisada');
    component.closureReviewed.set(true);
    await component.closeRoster();
    fixture.detectChanges();
    expect(api.closeRoster).toHaveBeenCalledWith('trip', 'trip', 'Nómina definitiva revisada');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Nómina cerrada');
    expect(text).toContain('La cobranza, los comprobantes y las devoluciones continúan');
    expect(text).not.toContain('Preparar borrador para revisión');
  });
});

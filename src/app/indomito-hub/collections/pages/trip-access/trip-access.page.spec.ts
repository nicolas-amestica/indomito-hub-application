import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionTripAccess } from '../../services/collection-trip-access';
import { TripAccessPage } from './trip-access.page';

describe('TripAccessPage', () => {
  const api = { get: vi.fn(), change: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockReturnValue(of({ tripId: 'trip', version: 1, status: 'ACTIVE' }));
    TestBed.configureTestingModule({
      imports: [TripAccessPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'trip' }) } },
        },
        { provide: CollectionTripAccess, useValue: api },
      ],
    });
  });

  it('no rota sin motivo y confirmacion explicita', async () => {
    const fixture = TestBed.createComponent(TripAccessPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as { change(action: 'rotate'): void };
    component.change('rotate');
    expect(api.change).not.toHaveBeenCalled();
  });

  it('publica el codigo nuevo devuelto por la operacion durable', async () => {
    api.change.mockReturnValue(
      of({ tripId: 'trip', tripCode: 'ABC234', version: 2, status: 'ACTIVE' }),
    );
    const fixture = TestBed.createComponent(TripAccessPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      change(action: 'rotate'): void;
      form: { setValue(value: unknown): void };
    };
    component.form.setValue({ reason: 'Rotacion autorizada', reviewed: true });
    component.change('rotate');
    fixture.detectChanges();
    expect(api.change).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('ABC234');
    expect(fixture.nativeElement.textContent).toContain('Código rotado');
  });
});

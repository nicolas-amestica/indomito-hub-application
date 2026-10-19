import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionRenditions } from '../../services/collection-renditions';
import { RenditionsPage } from './renditions.page';

describe('RenditionsPage', () => {
  const report = {
    id: 'report',
    providerId: 42,
    receivedAt: '2026-10-17T12:00:00Z',
    status: 'OBSERVED',
    processed: 1,
    total: 1,
    applied: 0,
    observed: 1,
    review: 0,
    retries: 0,
    policy: { mode: 'OBSERVE', revision: '' },
  };
  const api = { list: vi.fn(), detail: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockReturnValue(of({ items: [report] }));
    api.detail.mockReturnValue(
      of({
        rendition: report,
        items: [
          {
            paymentId: 'payment',
            tripId: 'trip',
            status: 'OBSERVED',
            gross: 10000,
            fee: 100,
            renditionDate: '2026-10-17',
          },
        ],
      }),
    );
    TestBed.configureTestingModule({
      imports: [RenditionsPage],
      providers: [provideRouter([]), { provide: CollectionRenditions, useValue: api }],
    });
  });

  it('muestra observación y detalle sin ofrecer acciones que modifiquen caja', async () => {
    const fixture = TestBed.createComponent(RenditionsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toContain('Observado, sin modificar caja');
    root
      .querySelector<HTMLButtonElement>('button[aria-label="Ver pagos de la rendición 42"]')
      ?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.detail).toHaveBeenCalledWith('report', '');
    expect(root.textContent).toContain('Comisión informada');
    expect(root.querySelector('a[href="/cobranza/giras/trip/tesoreria"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Aplicar a caja');
  });

  it('valida el mes y actualiza desde el formulario visible', async () => {
    const fixture = TestBed.createComponent(RenditionsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('#rendition-month')!;
    input.value = '2026-13';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.value = '2026-09';
    input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(api.list).toHaveBeenLastCalledWith('2026-09', '');
  });

  it('muestra errores recuperables sin revelar mensajes internos', async () => {
    api.list.mockReturnValue(throwError(() => new Error('private provider details')));
    const fixture = TestBed.createComponent(RenditionsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No fue posible consultar');
    expect(fixture.nativeElement.textContent).not.toContain('private provider details');
  });
});

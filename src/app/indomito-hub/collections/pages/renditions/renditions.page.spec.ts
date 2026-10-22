import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionRenditions } from '../../services/collection-renditions';
import { RenditionsPage } from './renditions.page';
import { AuthService } from '../../../../core/auth/auth.service';

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
  const api = { list: vi.fn(), detail: vi.fn(), replay: vi.fn() };
  const auth = { canPerform: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    auth.canPerform.mockReturnValue(true);
    api.replay.mockReturnValue(of({ status: 'PENDING' }));
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
      providers: [
        provideRouter([]),
        { provide: CollectionRenditions, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  it('oculta reprocesamiento para usuarios sin permiso de escritura', async () => {
    auth.canPerform.mockReturnValue(false);
    const fixture = TestBed.createComponent(RenditionsPage);
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Reprocesar rendición 42"]'),
    ).toBeNull();
    expect(api.replay).not.toHaveBeenCalled();
  });

  it('muestra observación y detalle sin cambiar la política desde la pantalla', async () => {
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

  it('solicita confirmación, evita doble envío y anuncia PENDING sin afirmar aplicación', async () => {
    const pending = new Subject<{ status: string }>();
    api.replay.mockReturnValue(pending);
    const fixture = TestBed.createComponent(RenditionsPage);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Reprocesar rendición 42"]')!.click();
    await fixture.whenStable();
    expect(api.replay).not.toHaveBeenCalled();
    const confirm = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Confirmar reprocesamiento',
    )!;
    expect(root.textContent).toContain('política vigente');
    confirm.click();
    await fixture.whenStable();
    expect(confirm.disabled).toBe(true);
    confirm.click();
    expect(api.replay).toHaveBeenCalledTimes(1);
    expect(api.replay).toHaveBeenCalledWith('report');
    pending.next({ status: 'PENDING' });
    pending.complete();
    await fixture.whenStable();
    expect(root.textContent).toContain('Todavía no confirma una liquidación');
    expect(root.querySelector('button[aria-label="Reprocesar rendición 42"]')).toBeNull();
  });

  it.each(['PENDING', 'COMPLETED'])('no ofrece reprocesar %s', async (status) => {
    api.list.mockReturnValue(of({ items: [{ ...report, status }] }));
    const fixture = TestBed.createComponent(RenditionsPage);
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Reprocesar rendición 42"]'),
    ).toBeNull();
  });

  it('permite cancelar sin enviar y maneja errores sin reintento automático', async () => {
    const fixture = TestBed.createComponent(RenditionsPage);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const clickText = (label: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent?.trim() === label)!
        .click();
    clickText('Reprocesar');
    await fixture.whenStable();
    clickText('Cancelar');
    await fixture.whenStable();
    expect(api.replay).not.toHaveBeenCalled();
    api.replay.mockReturnValue(throwError(() => new Error('private')));
    clickText('Reprocesar');
    await fixture.whenStable();
    clickText('Confirmar reprocesamiento');
    await fixture.whenStable();
    expect(root.textContent).toContain('Actualiza el listado antes');
    expect(root.textContent).not.toContain('private');
    expect(api.replay).toHaveBeenCalledTimes(1);
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

import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceivedTaxPage } from '../../interfaces/received-tax-document.interface';
import { ReceivedTaxDocuments } from '../../services/received-tax-documents';
import { ReceivedTaxDocumentsComponent } from './received-tax-documents.component';

describe('Documentos recibidos', () => {
  const document = {
    id: 'a'.repeat(64),
    kind: 33,
    folio: 12,
    issuerRut: '76000000-0',
    issuerName: 'Proveedor',
    receiverRut: '76111111-1',
    issueDate: '2026-11-01',
    receivedAt: '2026-11-09T12:00:00Z',
    total: 11900,
  };
  const api = {
    list: vi.fn(),
    events: vi.fn(),
    download: vi.fn(),
    synchronize: vi.fn(),
    syncStatus: vi.fn(),
  };
  const request = {
    id: '01M74A610GXJERSTB19KJK40G5',
    status: 'PENDING',
    requestedAt: '2026-11-11T12:00:00Z',
    startedAt: '',
    finishedAt: '',
    detail: '',
  };
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockReturnValue(
      of({
        items: [document],
        nextCursor: '',
        issues: [],
        sync: { lastSuccess: '2026-11-09T12:00:00Z' },
      }),
    );
    api.events.mockReturnValue(
      of({
        document,
        result: { code: 16, description: 'Sin eventos', events: [] },
        successful: false,
      }),
    );
    TestBed.configureTestingModule({
      imports: [ReceivedTaxDocumentsComponent],
      providers: [{ provide: ReceivedTaxDocuments, useValue: api }],
    });
  });

  it('consulta eventos al abrir y exige decisión, motivo y confirmación antes de registrar', async () => {
    const fixture = TestBed.createComponent(ReceivedTaxDocumentsComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      open(value: unknown): void;
      query(register: boolean): void;
      decision: FormGroup;
    };
    component.open(document);
    expect(api.events).toHaveBeenCalledWith(document.id, '2026-11', '', '', '');
    component.decision.patchValue({ action: 'ERM', reason: 'Mercaderías recibidas' });
    component.query(true);
    expect(api.events).toHaveBeenCalledTimes(1);
    component.decision.controls['confirmed'].setValue(true);
    component.query(true);
    expect(api.events).toHaveBeenCalledTimes(2);
    expect(api.events.mock.calls[1][2]).toBe('ERM');
    expect(api.events.mock.calls[1][3]).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    fixture.destroy();
  });

  it.each([
    { paymentForm: 1, code: 16, blocked: true },
    { paymentForm: 3, code: 16, blocked: true },
    { paymentForm: undefined, code: 27, blocked: true },
    { paymentForm: 2, code: 16, blocked: false },
    { paymentForm: undefined, code: 16, blocked: false },
  ])(
    'gestiona restricciones de pago $paymentForm y respuesta $code',
    async ({ paymentForm, code, blocked }) => {
      const current = { ...document, paymentForm };
      api.events.mockReturnValue(
        of({ document: current, result: { code, description: '', events: [] }, successful: false }),
      );
      const fixture = TestBed.createComponent(ReceivedTaxDocumentsComponent);
      await fixture.whenStable();
      const component = fixture.componentInstance as unknown as {
        open(value: unknown): void;
        query(register: boolean): void;
        decision: FormGroup;
        restriction(): string;
      };
      component.open(current);
      fixture.detectChanges();
      expect(!!component.restriction()).toBe(blocked);
      expect(!!fixture.nativeElement.querySelector('#received-action')).toBe(!blocked);
      component.decision.patchValue({
        action: 'ERM',
        reason: 'Servicio recibido',
        confirmed: true,
      });
      component.query(true);
      expect(api.events).toHaveBeenCalledTimes(blocked ? 1 : 2);
      fixture.destroy();
    },
  );

  it('consulta al cambiar el mes y descarta respuestas del mes anterior', async () => {
    const old = new Subject<ReceivedTaxPage>();
    api.list.mockReturnValueOnce(old);
    const fixture = TestBed.createComponent(ReceivedTaxDocumentsComponent);
    const component = fixture.componentInstance as unknown as {
      filters: FormGroup;
      items(): unknown[];
    };
    component.filters.controls['month'].setValue(new Date(2026, 8, 1));
    expect(api.list).toHaveBeenLastCalledWith('2026-09', '');
    old.next({ items: [], nextCursor: '', issues: [], sync: { lastSuccess: '' } });
    expect(component.items()).toEqual([document]);
    fixture.detectChanges();
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('button')).some(
        (button) => (button as HTMLButtonElement).textContent?.trim() === 'Consultar',
      ),
    ).toBe(false);
    fixture.destroy();
  });

  it('sigue su solicitud sin confundir otra lectura programada con éxito manual', async () => {
    const fixture = TestBed.createComponent(ReceivedTaxDocumentsComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      synchronize(): void;
      syncing(): boolean;
      notice(): string;
    };
    api.synchronize.mockReturnValue(of({ queued: true, request }));
    api.syncStatus.mockReturnValue(of({ ...request, status: 'RUNNING' }));
    vi.useFakeTimers();
    component.synchronize();
    component.synchronize();
    expect(api.synchronize).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(component.syncing()).toBe(true);
    expect(api.syncStatus).toHaveBeenCalledWith(request.id);
    api.list.mockReturnValue(
      of({
        items: [document],
        nextCursor: '',
        issues: [],
        sync: { lastSuccess: '2026-11-09T12:01:00Z' },
      }),
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(component.syncing()).toBe(true);
    api.syncStatus.mockReturnValue(of({ ...request, status: 'COMPLETED' }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(component.syncing()).toBe(false);
    expect(component.notice()).toContain('completada');
    fixture.destroy();
  });

  it('muestra una solicitud fallida sin anunciar documentos actualizados', async () => {
    const fixture = TestBed.createComponent(ReceivedTaxDocumentsComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      synchronize(): void;
      syncing(): boolean;
      notice(): string;
    };
    api.synchronize.mockReturnValue(of({ queued: true, request }));
    api.syncStatus.mockReturnValue(
      of({ ...request, status: 'FAILED', detail: 'No fue posible completar la lectura.' }),
    );
    vi.useFakeTimers();
    component.synchronize();
    await vi.advanceTimersByTimeAsync(0);
    expect(component.syncing()).toBe(false);
    expect(component.notice()).toContain('No fue posible');
    expect(component.notice()).not.toContain('actualizados');
    fixture.destroy();
  });

  it('retoma una solicitud pendiente al volver a abrir la pantalla', async () => {
    vi.useFakeTimers();
    api.list.mockReturnValue(
      of({ items: [], nextCursor: '', issues: [], sync: { lastSuccess: '' }, manualSync: request }),
    );
    api.syncStatus.mockReturnValue(of({ ...request, status: 'RUNNING' }));
    const fixture = TestBed.createComponent(ReceivedTaxDocumentsComponent);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.syncStatus).toHaveBeenCalledWith(request.id);
    expect(api.synchronize).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('presenta fallos de correo sin afirmar que no existen DTE en SII', async () => {
    api.list.mockReturnValue(
      of({
        items: [],
        nextCursor: '',
        sync: { lastSuccess: '' },
        issues: [{ messageId: 'mail', detail: 'XML inválido', status: 'QUARANTINED' }],
      }),
    );
    const fixture = TestBed.createComponent(ReceivedTaxDocumentsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('XML inválido');
    expect(fixture.nativeElement.textContent).toContain('No hay documentos incorporados');
    fixture.destroy();
  });
});

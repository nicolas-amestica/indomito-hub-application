import { ThemeService } from '../../../core/theme/theme.service';
import { HandoffRequestError } from '../types/handoff-request-error';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HandoffPageComponent } from './handoff.page';
import { HandoffApiService } from '../services/handoff-api.service';
import { HANDOFF_MESSAGES } from '../constants/handoff-messages';

const token = 'a'.repeat(43);
const sessionToken = 'b'.repeat(43);

describe('vista temporal de derivación', () => {
  const api = { redeem: vi.fn(), read: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers();
    api.redeem.mockReset();
    api.read.mockReset();
    TestBed.configureTestingModule({
      imports: [HandoffPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ThemeService,
          useValue: {
            label: () => 'Cambiar a modo oscuro',
            icon: () => 'icon-[tabler--moon]',
            toggle: vi.fn(),
          },
        },
        { provide: HandoffApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              fragment: `token=${token}`,
              paramMap: convertToParamMap({ phone: '56911112222' }),
            },
          },
        },
      ],
    });
    api.redeem.mockResolvedValue({
      sessionToken,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    });
    api.read.mockResolvedValue({
      phone: '56911112222',
      alias: 'Ana',
      reason: 'Solicita ayuda',
      derivedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      messages: [
        {
          id: '1',
          author: 'Cliente',
          type: 'customer',
          createdAt: new Date().toISOString(),
          text: 'Consulta Bariloche',
        },
      ],
      nextBefore: 'MSG#01AAAAAAAAAAAAAAAAAAAAAAAA',
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('no canjea el enlace al crear una vista previa y conserva el destino de login', () => {
    const component = TestBed.createComponent(HandoffPageComponent).componentInstance;
    expect(api.redeem).not.toHaveBeenCalled();
    expect(component.conversationQuery).toEqual({ telefono: '56911112222' });
    expect(component.canOpen()).toBe(true);
  });
  it('canjea una sola vez y elimina los mensajes al vencer los 30 minutos', async () => {
    const component = TestBed.createComponent(HandoffPageComponent).componentInstance;
    await component.open();
    expect(api.redeem).toHaveBeenCalledExactlyOnceWith(token);
    expect(api.read).toHaveBeenCalledWith(sessionToken, undefined);
    expect(component.page()?.messages[0].text).toBe('Consulta Bariloche');
    await component.open();
    expect(api.redeem).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1800000);
    expect(component.page()).toBeNull();
    expect(component.error()).toBe(HANDOFF_MESSAGES.expired);
    expect(component.canOpen()).toBe(false);
  });
  it('permite cargar mensajes anteriores con el mismo permiso', async () => {
    const component = TestBed.createComponent(HandoffPageComponent).componentInstance;
    await component.open();
    api.read.mockResolvedValueOnce({
      ...component.page(),
      messages: [{ id: '0', text: 'Mensaje anterior' }],
      nextBefore: undefined,
    });
    await component.loadOlder();
    expect(component.page()?.messages.map((m) => m.id)).toEqual(['0', '1']);
    expect(api.redeem).toHaveBeenCalledTimes(1);
  });
  it('ofrece iniciar sesión si el enlace ya fue utilizado o venció', async () => {
    api.redeem.mockRejectedValue(new HandoffRequestError('unavailable'));
    const component = TestBed.createComponent(HandoffPageComponent).componentInstance;
    await component.open();
    expect(component.page()).toBeNull();
    expect(component.canOpen()).toBe(false);
    expect(component.error()).toBe(HANDOFF_MESSAGES.unavailable);
  });
  it('no restaura mensajes si una respuesta llega después del vencimiento', async () => {
    const component = TestBed.createComponent(HandoffPageComponent).componentInstance;
    await component.open();
    let resolve: (value: unknown) => void = () => {};
    api.read.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const read = component.loadOlder();
    vi.advanceTimersByTime(1800000);
    resolve({ messages: [{ id: 'old' }] });
    await read;
    expect(component.page()).toBeNull();
  });
});

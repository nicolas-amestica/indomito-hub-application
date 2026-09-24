import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import type { ExchangeSnapshot } from '../interfaces/program.interface';
import { ExchangeRateService } from '../services/exchange-rate.service';
import { ExchangeRateStore } from './exchange-rate.store';

describe('ExchangeRateStore', () => {
  it('hace una sola solicitud al inicializar y publica el snapshot', () => {
    const response = new Subject<ExchangeSnapshot>();
    const service = { getSnapshot: vi.fn(() => response.asObservable()) };
    TestBed.configureTestingModule({
      providers: [ExchangeRateStore, { provide: ExchangeRateService, useValue: service }],
    });

    const store = TestBed.inject(ExchangeRateStore);
    expect(service.getSnapshot).toHaveBeenCalledTimes(1);
    expect(store.loading()).toBe(true);

    response.next({
      date: '2026-09-14',
      usdToClp: 950,
      brlToClp: 178,
      isFallback: false,
      source: 'banco-central',
    });
    response.complete();

    expect(store.snapshot()).toEqual({
      date: '2026-09-14',
      usdToClp: 950,
      brlToClp: 178,
      isFallback: false,
      source: 'banco-central',
    });
    expect(store.loading()).toBe(false);
    expect(store.hasError()).toBe(false);
  });

  it('deriva la advertencia y la fecha de un snapshot de respaldo', () => {
    const service = {
      getSnapshot: vi.fn(() => new Subject<ExchangeSnapshot>().asObservable()),
    };
    const response = new Subject<ExchangeSnapshot>();
    service.getSnapshot.mockReturnValue(response.asObservable());
    TestBed.configureTestingModule({
      providers: [ExchangeRateStore, { provide: ExchangeRateService, useValue: service }],
    });

    const store = TestBed.inject(ExchangeRateStore);
    response.next({
      date: '2026-09-12',
      usdToClp: 940,
      brlToClp: 175,
      isFallback: true,
      source: 'banco-central',
    });

    expect(store.usingFallback()).toBe(true);
    expect(store.fallbackDate()).toBe('2026-09-12');
  });

  it('expone el error y permite reintentar después de una falla', () => {
    const first = new Subject<ExchangeSnapshot>();
    const second = new Subject<ExchangeSnapshot>();
    const service = {
      getSnapshot: vi
        .fn()
        .mockReturnValueOnce(first.asObservable())
        .mockReturnValueOnce(second.asObservable()),
    };
    TestBed.configureTestingModule({
      providers: [ExchangeRateStore, { provide: ExchangeRateService, useValue: service }],
    });

    const store = TestBed.inject(ExchangeRateStore);
    const failure = new Error('sin conexión');
    first.error(failure);

    expect(store.error()).toBe(failure);
    expect(store.loading()).toBe(false);

    store.retry();
    expect(service.getSnapshot).toHaveBeenCalledTimes(2);
    expect(store.loading()).toBe(true);
    expect(store.error()).toBeNull();

    second.next({
      date: '2026-09-14',
      usdToClp: 950,
      brlToClp: 178,
      isFallback: false,
      source: 'banco-central',
    });
    second.complete();
    expect(store.hasError()).toBe(false);
  });

  it('ignora un reintento mientras la solicitud inicial sigue en curso', () => {
    const response = new Subject<ExchangeSnapshot>();
    const service = { getSnapshot: vi.fn(() => response.asObservable()) };
    TestBed.configureTestingModule({
      providers: [ExchangeRateStore, { provide: ExchangeRateService, useValue: service }],
    });

    const store = TestBed.inject(ExchangeRateStore);
    store.retry();

    expect(service.getSnapshot).toHaveBeenCalledTimes(1);
  });
});

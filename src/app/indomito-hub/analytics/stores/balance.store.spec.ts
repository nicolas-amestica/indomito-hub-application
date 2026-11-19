import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BalanceStore } from './balance.store';
import { BalanceService } from '../services/balance.service';
import type { BalanceDetail } from '../interfaces/balance.interface';
import { balanceDetailFixture } from '../fn/__fixtures__/balance.fixture';

describe('BalanceStore: consistencia de respuestas y comandos', () => {
  const api = { list: vi.fn(), detail: vi.fn(), save: vi.fn() };
  let store: BalanceStore;
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [BalanceStore, { provide: BalanceService, useValue: api }],
    });
    store = TestBed.inject(BalanceStore);
  });
  it('procesa toda la paginación sin descargar cuentas al navegador', async () => {
    const detail = balanceDetailFixture();
    api.list
      .mockReturnValueOnce(of({ items: [detail.row], nextCursor: 'next', ...detail }))
      .mockReturnValueOnce(of({ items: [], nextCursor: '', ...detail }));
    await store.load(2026, detail.from, detail.to);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.list.mock.calls[1][3]).toBe('next');
    expect(store.rows()).toHaveLength(1);
  });
  it('descarta respuestas atrasadas al cambiar de viaje', async () => {
    const first = new Subject<BalanceDetail>();
    const second = new Subject<BalanceDetail>();
    api.detail.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const a = balanceDetailFixture();
    const b = balanceDetailFixture('01J00000000000000000000001');
    const requestA = store.select(a.row.trip.id);
    const requestB = store.select(b.row.trip.id);
    second.next(b);
    second.complete();
    await requestB;
    first.next(a);
    first.complete();
    await requestA;
    expect(store.detail()?.row.trip.id).toBe(b.row.trip.id);
  });
  it('conserva el borrador y reutiliza el comando si se pierde una respuesta', async () => {
    const detail = balanceDetailFixture();
    store.detail.set(detail);
    store.edit(structuredClone(detail.row.state.current!));
    api.save
      .mockReturnValueOnce(throwError(() => new Error('timeout')))
      .mockReturnValueOnce(of({ ...detail.row.state, version: 2 }));
    expect(await store.save('SAVE', 'Cambio de prueba')).toBe(false);
    expect(store.dirty()).toBe(true);
    expect(store.draft()).not.toBeNull();
    expect(await store.save('SAVE', 'Cambio de prueba')).toBe(true);
    expect(api.save.mock.calls[0][1].commandId).toBe(api.save.mock.calls[1][1].commandId);
    expect(store.dirty()).toBe(false);
  });
  it('rechaza paginación circular como error, sin resultados financieros parciales', async () => {
    const detail = balanceDetailFixture();
    api.list.mockReturnValue(of({ items: [detail.row], nextCursor: 'same', ...detail }));
    await store.load(2026, detail.from, detail.to);
    expect(store.rows()).toEqual([]);
    expect(store.error()).not.toBe('');
  });
});

import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { DEFAULT_SCENARIO_OFFSETS } from '../constants/scenario-defaults';
import { buildProgramForm } from '../forms/program-form.builder';
import type { CatalogResponse } from '../interfaces/catalog.interface';
import { CatalogService } from '../services/catalog.service';
import { CatalogStore } from './catalog.store';

const CATALOGS: CatalogResponse = {
  plans: [
    { id: 'study', display: 'Gira de estudio', order: 1 },
    { id: 'private', display: 'Particular', order: 2 },
  ],
  seasons: [{ id: '2027', display: '2027', order: 1 }],
  destinations: [
    {
      id: 'BRF',
      display: 'Florianópolis',
      order: 1,
      budgetTemplateId: 'brochure-default',
    },
  ],
  settings: {
    defaultPlanId: 'study',
    margin: {
      usdIncreaseCLP: 50,
      brlIncreaseCLP: 10,
      utilityRate: 20,
      rechargeRate: 5,
      minUtilityRate: 10,
    },
  },
};

function setup(responses: Subject<CatalogResponse>[]): {
  store: CatalogStore;
  service: { getCatalogs: ReturnType<typeof vi.fn> };
} {
  const getCatalogs = vi.fn();
  for (const response of responses) getCatalogs.mockReturnValueOnce(response.asObservable());
  const service = { getCatalogs };
  TestBed.configureTestingModule({
    providers: [CatalogStore, { provide: CatalogService, useValue: service }],
  });

  return { store: TestBed.inject(CatalogStore), service };
}

describe('CatalogStore', () => {
  it('hace una sola solicitud inicial y publica las tres listas', () => {
    const response = new Subject<CatalogResponse>();
    const { store, service } = setup([response]);

    expect(service.getCatalogs).toHaveBeenCalledTimes(1);
    expect(store.loading()).toBe(true);

    response.next(CATALOGS);
    response.complete();

    expect(store.plans()).toEqual(CATALOGS.plans);
    expect(store.seasons()).toEqual(CATALOGS.seasons);
    expect(store.destinations()).toEqual(CATALOGS.destinations);
    expect(store.loading()).toBe(false);
  });

  it('preselecciona el plan vigente configurado y conserva pristine', () => {
    const response = new Subject<CatalogResponse>();
    const { store } = setup([response]);
    const form = buildProgramForm();
    response.next(CATALOGS);

    store.applyDefaults(form);

    expect(form.controls.generals.controls.plan.value).toEqual(CATALOGS.plans[0]);
    expect(form.controls.generals.controls.plan.pristine).toBe(true);
    expect(form.controls.pricing.getRawValue()).toEqual({
      usdIncreaseCLP: 50,
      brlIncreaseCLP: 10,
      utilityRate: 20,
      rechargeRate: 5,
    });
  });

  it('no elige un plan inexistente ni el primer elemento como respaldo', () => {
    const response = new Subject<CatalogResponse>();
    const { store } = setup([response]);
    const form = buildProgramForm();
    response.next({
      ...CATALOGS,
      settings: { ...CATALOGS.settings, defaultPlanId: 'inexistente' },
    });

    store.applyDefaults(form);

    expect(form.controls.generals.controls.plan.value).toBeNull();
    expect(form.controls.generals.controls.plan.hasError('required')).toBe(true);
  });

  it('no sobrescribe el plan que el usuario ya eligió', () => {
    const response = new Subject<CatalogResponse>();
    const { store } = setup([response]);
    const form = buildProgramForm();
    const plan = form.controls.generals.controls.plan;
    plan.setValue(CATALOGS.plans[1]);
    plan.markAsDirty();
    response.next(CATALOGS);

    store.applyDefaults(form);

    expect(plan.value).toEqual(CATALOGS.plans[1]);
  });

  it('usa los desplazamientos por defecto cuando settings los omite', () => {
    const response = new Subject<CatalogResponse>();
    const { store } = setup([response]);
    response.next(CATALOGS);

    expect(store.scenarioOffsets()).toEqual(DEFAULT_SCENARIO_OFFSETS);
  });

  it('expone el error y permite reintentar', () => {
    const first = new Subject<CatalogResponse>();
    const second = new Subject<CatalogResponse>();
    const { store, service } = setup([first, second]);
    const failure = new Error('sin conexión');
    first.error(failure);

    expect(store.error()).toBe(failure);
    expect(store.loading()).toBe(false);

    store.retry();
    expect(service.getCatalogs).toHaveBeenCalledTimes(2);
    expect(store.error()).toBeNull();

    second.next(CATALOGS);
    second.complete();
    expect(store.hasError()).toBe(false);
  });
});

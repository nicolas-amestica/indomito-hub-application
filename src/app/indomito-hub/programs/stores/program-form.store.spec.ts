import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import fc from 'fast-check';

import { favoriteContentFromProgram } from '../fn/fn-favorite-content';
import type { CatalogResponse } from '../interfaces/catalog.interface';
import type { ExchangeSnapshot } from '../interfaces/program.interface';
import { CatalogStore } from './catalog.store';
import { ExchangeRateStore } from './exchange-rate.store';
import { ProgramFormStore } from './program-form.store';

const SNAPSHOT: ExchangeSnapshot = {
  date: '2026-09-14',
  usdToClp: 950,
  brlToClp: 178,
  isFallback: false,
  source: 'banco-central',
};

const CATALOGS: CatalogResponse = {
  plans: [{ id: 'plan-1', display: 'Gira de estudio', order: 1 }],
  seasons: [{ id: '2027', display: '2027', order: 1 }],
  destinations: [
    {
      id: 'brx',
      display: 'Brasil',
      order: 1,
      budgetTemplateId: 'brochure-default',
    },
  ],
  settings: {},
};

function createStore(catalog: CatalogResponse | null = null): {
  store: ProgramFormStore;
  catalogState: ReturnType<typeof signal<CatalogResponse | null>>;
  rateState: ReturnType<typeof signal<ExchangeSnapshot | null>>;
} {
  const catalogState = signal<CatalogResponse | null>(catalog);
  const rateState = signal<ExchangeSnapshot | null>(SNAPSHOT);
  const catalogStore = {
    catalogs: catalogState.asReadonly(),
    settings: computed(() => catalogState()?.settings ?? null),
    plans: computed(() => catalogState()?.plans ?? []),
    seasons: computed(() => catalogState()?.seasons ?? []),
    destinations: computed(() => catalogState()?.destinations ?? []),
    applyDefaults: vi.fn(),
  };
  const rateStore = { snapshot: rateState.asReadonly() };

  TestBed.configureTestingModule({
    providers: [
      ProgramFormStore,
      { provide: CatalogStore, useValue: catalogStore },
      { provide: ExchangeRateStore, useValue: rateStore },
    ],
  });

  return { store: TestBed.inject(ProgramFormStore), catalogState, rateState };
}

function completeCalculationFields(store: ProgramFormStore): void {
  const form = store.form;
  form.controls.schedule.setValue({
    totalDays: 7,
    totalNights: 5,
    totalPassengers: 30,
    freePassengers: 2,
  });
  form.controls.pricing.setValue({
    usdIncreaseCLP: 50,
    brlIncreaseCLP: 10,
    utilityRate: 20,
    rechargeRate: 5,
  });
  form.controls.crews.at(0).setValue({
    id: form.controls.crews.at(0).controls.id.value,
    name: 'Coordinador',
    documentId: '12345678',
    dailyPrice: 45_000,
    currency: 'CLP',
  });
  form.controls.services.at(0).setValue({
    id: form.controls.services.at(0).controls.id.value,
    name: 'Hotel',
    chargeType: 'per_passenger_night',
    unitPrice: 55,
    currency: 'USD',
  });
}

function completeGeneralFields(store: ProgramFormStore, name = 'Brasil 2027'): void {
  store.form.controls.generals.setValue({
    name,
    description: 'Gira pedagógica',
    plan: CATALOGS.plans[0],
    season: CATALOGS.seasons[0],
    destination: CATALOGS.destinations[0],
    departureCity: 'Santiago',
  });
}

describe('ProgramFormStore', () => {
  it('mantiene los derivados vacíos mientras faltan entradas obligatorias', () => {
    const { store } = createStore();

    expect(store.effectiveRates()).toBeNull();
    expect(store.derived()).toBeNull();
    expect(store.rows()).toEqual([]);
    expect(store.totals()).toBeNull();
  });

  it('calcula tasas, filas y totales al completar las secciones necesarias', () => {
    const { store } = createStore();
    completeCalculationFields(store);

    expect(store.totalDays()).toBe(7);
    expect(store.payingPassengers()).toBe(28);
    expect(store.effectiveRates()).toEqual({ CLP: 1, USD: 1000, BRL: 188 });
    expect(store.rows()).toHaveLength(2);
    expect(store.totals()?.totalCLP).toBeGreaterThan(0);
  });

  it('proyecta el formulario válido a un programa completo sin recalcular en la vista', () => {
    const { store } = createStore();
    completeCalculationFields(store);
    store.form.controls.generals.setValue({
      name: '  Brasil 2027  ',
      description: '  Gira pedagógica  ',
      plan: { id: 'plan-1', display: 'Gira de estudio', order: 1 },
      season: { id: '2027', display: '2027', order: 1 },
      destination: {
        id: 'brx',
        display: 'Brasil',
        order: 1,
        budgetTemplateId: 'brochure-default',
      },
      departureCity: '  Santiago  ',
    });

    const program = store.program();

    expect(store.canPreview()).toBe(true);
    expect(program?.generals).toEqual({
      name: 'Brasil 2027',
      description: 'Gira pedagógica',
      plan: { id: 'plan-1', display: 'Gira de estudio' },
      season: { id: '2027', display: '2027' },
      destination: { id: 'brx', display: 'Brasil' },
      departureCity: 'Santiago',
    });
    expect(program?.crews[0]).toMatchObject({ name: 'Coordinador', baseAmount: 315_000 });
    expect(program?.services[0]).toMatchObject({ name: 'Hotel', baseAmount: 8_250 });
    expect(program?.totals).toBe(store.totals());
  });

  it('Feature: program-form, Property 25: Guardar y cargar un favorito reproduce el contenido', () => {
    const { store } = createStore(CATALOGS);
    completeCalculationFields(store);

    fc.assert(
      fc.property(validProgramName(), (name) => {
        completeGeneralFields(store, name);
        const content = favoriteContentFromProgram(store.program()!);
        store.form.controls.generals.controls.name.setValue('Programa modificado');

        store.loadFavorite(content);

        expect(favoriteContentFromProgram(store.program()!)).toEqual(content);
        expect(store.nightsSource()).toBe('user');
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: program-form, Property 26: Un favorito cargado se calcula con la tasa vigente', () => {
    const { store, rateState } = createStore(CATALOGS);
    completeCalculationFields(store);
    completeGeneralFields(store);
    const content = favoriteContentFromProgram(store.program()!);

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2_000 }),
        fc.integer({ min: 1, max: 500 }),
        (usdToClp, brlToClp) => {
          const currentSnapshot: ExchangeSnapshot = {
            date: '2027-03-01',
            usdToClp,
            brlToClp,
            isFallback: false,
            source: 'banco-central',
          };
          rateState.set(currentSnapshot);

          store.loadFavorite(content);

          expect(store.program()?.pricing.exchange).toEqual(currentSnapshot);
          expect(store.rows()[1].effectiveRate).toBe(usdToClp + content.pricing.usdIncreaseCLP);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no recalcula los totales al cambiar datos generales o el filtro', () => {
    const { store } = createStore();
    completeCalculationFields(store);
    const totals = store.totals();

    store.form.controls.generals.controls.name.setValue('Otro nombre');
    store.searchTerm.set('hotel');

    expect(store.totals()).toBe(totals);
    expect(store.visibleRows().map((row) => row.name)).toEqual(['Hotel']);
  });

  it('Feature: program-form, Property 29: Los totales del pie no dependen del filtro de búsqueda', () => {
    const { store } = createStore();
    completeCalculationFields(store);

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999_999 }),
        fc.integer({ min: 1, max: 99_999_999 }),
        fc.string(),
        (crewPrice, servicePrice, searchTerm) => {
          store.form.controls.crews.at(0).controls.dailyPrice.setValue(crewPrice);
          store.form.controls.services.at(0).controls.unitPrice.setValue(servicePrice);
          const totalsBeforeFilter = store.totals();

          store.searchTerm.set(searchTerm);

          expect(store.totals()).toBe(totalsBeforeFilter);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('precarga las noches hasta que el usuario decide un valor', () => {
    const { store } = createStore();
    const schedule = store.form.controls.schedule.controls;

    schedule.totalDays.setValue(7);
    expect(schedule.totalNights.value).toBe(6);
    expect(store.nightsSource()).toBe('preloaded');

    schedule.totalNights.setValue(4);
    expect(store.nightsSource()).toBe('user');

    schedule.totalDays.setValue(9);
    expect(schedule.totalNights.value).toBe(4);
  });

  it('Feature: program-form, Property 24: Las noches se precargan hasta que el usuario decide, y después no', () => {
    const { store } = createStore();
    const schedule = store.form.controls.schedule.controls;
    fc.assert(
      fc.property(arbNightsSequence(), ({ totalDays, interventionIndex, userNights }) => {
        store.resetForm();
        let decidedNights: number | null = null;

        totalDays.forEach((days, index) => {
          schedule.totalDays.setValue(days);

          if (index === interventionIndex) {
            schedule.totalNights.setValue(userNights);
            decidedNights = userNights;
          }

          if (decidedNights === null) {
            expect(schedule.totalNights.value).toBe(Math.max(0, days - 1));
            expect(store.nightsSource()).toBe('preloaded');
          } else {
            expect(schedule.totalNights.value).toBe(decidedNights);
            expect(store.nightsSource()).toBe('user');
          }
        });
      }),
      { numRuns: 100 },
    );
  });

  it('considera decididas las noches cargadas desde un favorito', () => {
    const { store } = createStore();
    const schedule = store.form.controls.schedule.controls;
    schedule.totalDays.setValue(7);

    store.setNightsFromFavorite(8);
    schedule.totalDays.setValue(17);

    expect(store.nightsSource()).toBe('user');
    expect(schedule.totalNights.value).toBe(8);
  });

  it('un reset reactiva la precarga de noches', () => {
    const { store } = createStore();
    const schedule = store.form.controls.schedule.controls;
    schedule.totalNights.setValue(8);
    expect(store.nightsSource()).toBe('user');

    store.resetForm();
    schedule.totalDays.setValue(5);

    expect(store.nightsSource()).toBe('preloaded');
    expect(schedule.totalNights.value).toBe(4);
  });

  it('expone las advertencias sin invalidar el formulario', () => {
    const catalogs: CatalogResponse = {
      plans: [],
      seasons: [],
      destinations: [],
      settings: {
        margin: {
          usdIncreaseCLP: 50,
          brlIncreaseCLP: 10,
          utilityRate: 20,
          rechargeRate: 5,
          minUtilityRate: 15,
        },
      },
    };
    const { store } = createStore(catalogs);
    const schedule = store.form.controls.schedule;
    schedule.setValue({
      totalDays: 3,
      totalNights: 4,
      totalPassengers: 30,
      freePassengers: 2,
    });
    store.form.controls.pricing.setValue({
      usdIncreaseCLP: 50,
      brlIncreaseCLP: 10,
      utilityRate: 10,
      rechargeRate: 5,
    });

    expect(store.nightsExceedDays()).toBe(true);
    expect(store.belowUtilityFloor()).toBe(true);
    expect(schedule.valid).toBe(true);
    expect(store.form.controls.pricing.valid).toBe(true);
  });
});

function validProgramName(): fc.Arbitrary<string> {
  return fc.string({ minLength: 3, maxLength: 40 }).filter((name) => name.trim().length >= 3);
}

/** Secuencia de fechas con una intervención opcional del usuario intercalada. */
function arbNightsSequence(): fc.Arbitrary<{
  totalDays: number[];
  interventionIndex: number | null;
  userNights: number;
}> {
  return fc
    .array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 })
    .chain((totalDays) =>
      fc.record({
        totalDays: fc.constant(totalDays),
        interventionIndex: fc.option(fc.integer({ min: 0, max: totalDays.length - 1 }), {
          nil: null,
          freq: 2,
        }),
        userNights: fc.integer({ min: 1, max: 100 }),
      }),
    );
}

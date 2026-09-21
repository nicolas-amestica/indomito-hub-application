import { FIELD_LIMITS } from '../constants/field-limits';
import {
  addCrew,
  addService,
  buildProgramForm,
  duplicateService,
  PAYING_PASSENGER_ERROR_KEY,
  removeCrew,
  removeService,
} from './program-form.builder';

function sequentialIds(): () => string {
  let current = 0;
  return () => `row-${++current}`;
}

describe('buildProgramForm', () => {
  it('construye solo las cinco secciones de entrada y ninguna salida derivada', () => {
    const form = buildProgramForm(sequentialIds());

    expect(Object.keys(form.controls)).toEqual([
      'generals',
      'schedule',
      'pricing',
      'crews',
      'services',
    ]);
    expect(Object.keys(form.controls.schedule.controls)).toEqual([
      'startDate',
      'endDate',
      'totalNights',
      'totalPassengers',
      'freePassengers',
    ]);
    expect(form.get('schedule.totalDays')).toBeNull();
    expect(form.get('schedule.payingPassengers')).toBeNull();
    expect(form.get('totals')).toBeNull();
    expect(form.get('pricing.exchange')).toBeNull();
  });

  it('inicia inválido, con una fila de tripulante y una de servicio', () => {
    const form = buildProgramForm(sequentialIds());

    expect(form.invalid).toBe(true);
    expect(form.controls.crews.length).toBe(1);
    expect(form.controls.services.length).toBe(1);
    expect(form.controls.crews.at(0).controls.id.value).toBe('row-1');
    expect(form.controls.services.at(0).controls.id.value).toBe('row-2');
  });

  it('mantiene la descripción opcional', () => {
    const description = buildProgramForm().controls.generals.controls.description;

    expect(description.value).toBe('');
    expect(description.valid).toBe(true);
  });

  it('valida el nombre sobre su valor recortado', () => {
    const name = buildProgramForm().controls.generals.controls.name;

    name.setValue('   ');
    expect(name.hasError('required')).toBe(true);

    name.setValue('  ab  ');
    expect(name.getError('minlength')).toEqual({
      requiredLength: FIELD_LIMITS.nameMinLength,
      actualLength: 2,
    });

    name.setValue('  abc  ');
    expect(name.valid).toBe(true);
  });

  it('aplica los rangos desde FIELD_LIMITS a cantidades y precios', () => {
    const form = buildProgramForm();
    const passengers = form.controls.schedule.controls.totalPassengers;
    const crewPrice = form.controls.crews.at(0).controls.dailyPrice;

    passengers.setValue(FIELD_LIMITS.totalPassengers.max + 1);
    crewPrice.setValue(FIELD_LIMITS.itemPrice.min - 0.01);

    expect(passengers.hasError('numericRange')).toBe(true);
    expect(crewPrice.hasError('numericRange')).toBe(true);
  });

  it('rechaza un calendario sin pasajeros pagantes', () => {
    const schedule = buildProgramForm().controls.schedule;

    schedule.controls.totalPassengers.setValue(20);
    schedule.controls.freePassengers.setValue(20);

    expect(schedule.hasError(PAYING_PASSENGER_ERROR_KEY)).toBe(true);

    schedule.controls.freePassengers.setValue(19);
    expect(schedule.hasError(PAYING_PASSENGER_ERROR_KEY)).toBe(false);
  });

  it('exige precios enteros solamente para CLP', () => {
    const crew = buildProgramForm().controls.crews.at(0);
    crew.controls.dailyPrice.setValue(10_000.5);

    crew.controls.currency.setValue('CLP');
    expect(crew.hasError('clpIntegerPrice')).toBe(true);

    crew.controls.currency.setValue('USD');
    expect(crew.hasError('clpIntegerPrice')).toBe(false);
  });
});

describe('operaciones de filas', () => {
  it('no elimina la única fila de cada lista', () => {
    const form = buildProgramForm();

    expect(removeCrew(form.controls.crews, 0)).toBe(false);
    expect(removeService(form.controls.services, 0)).toBe(false);
    expect(form.controls.crews.length).toBe(1);
    expect(form.controls.services.length).toBe(1);
  });

  it('agrega al final y permite eliminar mientras queda otra fila', () => {
    const ids = sequentialIds();
    const form = buildProgramForm(ids);

    expect(addCrew(form.controls.crews, ids)).toBe(true);
    expect(addService(form.controls.services, ids)).toBe(true);
    expect(form.controls.crews.length).toBe(2);
    expect(form.controls.services.length).toBe(2);

    expect(removeCrew(form.controls.crews, 0)).toBe(true);
    expect(removeService(form.controls.services, 0)).toBe(true);
    expect(form.controls.crews.length).toBe(1);
    expect(form.controls.services.length).toBe(1);
  });

  it('duplica todos los valores editables del servicio con otra identidad', () => {
    const ids = sequentialIds();
    const services = buildProgramForm(ids).controls.services;
    const original = services.at(0);
    original.patchValue({
      name: 'Hotel',
      chargeType: 'per_passenger_night',
      unitPrice: 55.5,
      currency: 'USD',
    });

    expect(duplicateService(services, 0, ids)).toBe(true);

    const first = services.at(0).getRawValue();
    const duplicate = services.at(1).getRawValue();
    expect(duplicate).toEqual({ ...first, id: 'row-3' });
    expect(duplicate.id).not.toBe(first.id);
  });

  it('respeta los máximos de tripulantes y servicios', () => {
    const ids = sequentialIds();
    const form = buildProgramForm(ids);

    while (form.controls.crews.length < FIELD_LIMITS.maxCrews) {
      expect(addCrew(form.controls.crews, ids)).toBe(true);
    }
    while (form.controls.services.length < FIELD_LIMITS.maxServices) {
      expect(addService(form.controls.services, ids)).toBe(true);
    }

    expect(addCrew(form.controls.crews, ids)).toBe(false);
    expect(addService(form.controls.services, ids)).toBe(false);
    expect(form.controls.crews.length).toBe(FIELD_LIMITS.maxCrews);
    expect(form.controls.services.length).toBe(FIELD_LIMITS.maxServices);
  });

  it('ignora índices fuera de la lista', () => {
    const form = buildProgramForm();

    expect(duplicateService(form.controls.services, -1)).toBe(false);
    expect(removeCrew(form.controls.crews, 10)).toBe(false);
    expect(removeService(form.controls.services, 10)).toBe(false);
  });
});

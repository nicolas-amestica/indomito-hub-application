import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Select } from 'primeng/select';

import { addService, buildProgramForm } from '../../forms/program-form.builder';
import { ServicesPanelComponent } from './services-panel.component';

describe('ServicesPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ServicesPanelComponent] }).compileComponents();
  });

  function createPanel() {
    const fixture = TestBed.createComponent(ServicesPanelComponent);
    const services = buildProgramForm().controls.services;
    fixture.componentRef.setInput('services', services);
    return { fixture, services };
  }

  it('parte con una fila y protege su accion de eliminar', async () => {
    const { fixture, services } = createPanel();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(services.length).toBe(1);
    expect(host.querySelectorAll('article')).toHaveLength(1);
    expect(
      host.querySelector<HTMLButtonElement>('[aria-label="Eliminar servicio 1"]')?.disabled,
    ).toBe(true);
    expect(host.querySelector('[aria-label="Duplicar servicio 1"]')).not.toBeNull();
  });

  it('agrega una fila vacia al final', async () => {
    const { fixture, services } = createPanel();
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.add-service-button')!
      .click();
    await fixture.whenStable();

    expect(services.length).toBe(2);
    expect(services.at(1).getRawValue()).toMatchObject({
      name: '',
      chargeType: null,
      unitPrice: null,
      currency: null,
    });
  });

  it('duplica al final todos los valores editables con otra identidad', async () => {
    const { fixture, services } = createPanel();
    services.at(0).setValue({
      id: services.at(0).controls.id.value,
      name: 'Hotel',
      chargeType: 'per_passenger_night',
      unitPrice: 42.5,
      currency: 'USD',
    });
    await fixture.whenStable();
    const original = services.at(0).getRawValue();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="Duplicar servicio 1"]')!
      .click();
    await fixture.whenStable();
    const duplicate = services.at(1).getRawValue();

    expect(duplicate.id).not.toBe(original.id);
    expect({ ...duplicate, id: original.id }).toEqual(original);
  });

  it('elimina solamente la fila elegida', async () => {
    const { fixture, services } = createPanel();
    addService(services);
    services.at(0).controls.name.setValue('Traslado');
    services.at(1).controls.name.setValue('Hotel');
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="Eliminar servicio 1"]')!
      .click();
    await fixture.whenStable();

    expect(services.length).toBe(1);
    expect(services.at(0).controls.name.value).toBe('Hotel');
  });

  it('ofrece los cinco tipos de cobro y las tres monedas del contrato', async () => {
    const { fixture } = createPanel();
    await fixture.whenStable();
    const selects = fixture.debugElement
      .queryAll(By.directive(Select))
      .map((item) => item.componentInstance as Select);

    expect(selects[0].options()!.map((option: { label: string }) => option.label)).toEqual([
      'Valor único',
      'Valor una vez por pasajero',
      'Valor por pasajero por noche',
      'Valor por día',
      'Valor por pasajero por día',
    ]);
    expect(selects[1].options()!.map((option: { value: string }) => option.value)).toEqual([
      'CLP',
      'USD',
      'BRL',
    ]);
  });

  it('rechaza precios decimales en CLP y muestra un error asociado', async () => {
    const { fixture, services } = createPanel();
    const row = services.at(0);
    row.patchValue({ unitPrice: 10.5, currency: 'CLP' });
    row.controls.unitPrice.markAsTouched();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(row.hasError('clpIntegerPrice')).toBe(true);
    expect(host.querySelector('#service-0-unit-price')?.getAttribute('aria-describedby')).toBe(
      'service-0-unit-price-error',
    );
    expect(host.textContent).toContain('El precio en CLP debe ser un número entero.');
  });
});

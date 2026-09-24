import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Select } from 'primeng/select';

import { buildProgramForm } from '../../forms/program-form.builder';
import type { CatalogOption, DestinationOption } from '../../interfaces/catalog.interface';
import { GeneralDataPanelComponent } from './general-data-panel.component';

const plans: CatalogOption[] = [
  { id: 'plan-estudio', display: 'Gira de estudio', order: 1 },
  { id: 'plan-particular', display: 'Particular', order: 2 },
];
const seasons: CatalogOption[] = [{ id: '2027', display: '2027', order: 2027 }];
const destinations: DestinationOption[] = [
  { id: 'brx', display: 'Brasil', order: 1, budgetTemplateId: 'default' },
];

describe('GeneralDataPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneralDataPanelComponent],
    }).compileComponents();
  });

  function createPanel(loading = false) {
    const fixture = TestBed.createComponent(GeneralDataPanelComponent);
    const group = buildProgramForm(() => 'row-id').controls.generals;

    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('plans', plans);
    fixture.componentRef.setInput('seasons', seasons);
    fixture.componentRef.setInput('destinations', destinations);
    fixture.componentRef.setInput('loading', loading);

    return { fixture, group };
  }

  it('se crea sin inyectar servicios y muestra los seis campos', async () => {
    const { fixture } = createPanel();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('#program-name')).not.toBeNull();
    expect(host.querySelector('#program-description')).not.toBeNull();
    expect(host.querySelector('#program-plan')).not.toBeNull();
    expect(host.querySelector('#program-season')).not.toBeNull();
    expect(host.querySelector('#program-destination')).not.toBeNull();
    expect(host.querySelector('#program-departure-city')).not.toBeNull();
  });

  it('enlaza las opciones y bloquea los selectores mientras cargan los catalogos', async () => {
    const { fixture } = createPanel(true);
    await fixture.whenStable();
    const selects = fixture.debugElement
      .queryAll(By.directive(Select))
      .map((item) => item.componentInstance as Select);

    expect(selects).toHaveLength(3);
    expect(selects[0].options()).toBe(plans);
    expect(selects[1].options()).toBe(seasons);
    expect(selects[2].options()).toBe(destinations);
    expect(selects.every((select) => select.loading() && select.$disabled())).toBe(true);
  });

  it('no muestra errores antes de que el usuario toque los campos', async () => {
    const { fixture } = createPanel();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('[id$="-error"]')).toHaveLength(0);
    expect(host.querySelector('#program-name')?.getAttribute('aria-describedby')).toBeNull();
  });

  it('muestra mensajes accesibles bajo cada campo obligatorio despues de tocarlo', async () => {
    const { fixture, group } = createPanel();
    group.controls.name.markAsTouched();
    group.controls.plan.markAsTouched();
    group.controls.season.markAsTouched();
    group.controls.destination.markAsTouched();
    group.controls.departureCity.markAsTouched();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    for (const field of ['name', 'plan', 'season', 'destination', 'departure-city']) {
      const control = host.querySelector(`#program-${field}`);
      expect(control?.getAttribute('aria-invalid')).toBe('true');
      expect(control?.getAttribute('aria-describedby')).toBe(`program-${field}-error`);
      expect(host.querySelector(`#program-${field}-error`)).not.toBeNull();
    }
  });

  it('distingue el error de largo minimo del nombre', async () => {
    const { fixture, group } = createPanel();
    group.controls.name.setValue('AB');
    group.controls.name.markAsTouched();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('#program-name-error')?.textContent?.trim()).toBe(
      'El nombre debe tener al menos 3 caracteres.',
    );
  });

  it('escribe los valores de texto en el grupo recibido', async () => {
    const { fixture, group } = createPanel();
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#program-name',
    )!;

    input.value = 'Brasil 2027';
    input.dispatchEvent(new Event('input'));

    expect(group.controls.name.value).toBe('Brasil 2027');
  });
});

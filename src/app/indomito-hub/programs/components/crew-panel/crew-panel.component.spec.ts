import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Select } from 'primeng/select';

import { buildProgramForm } from '../../forms/program-form.builder';
import { CrewPanelComponent } from './crew-panel.component';

describe('CrewPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CrewPanelComponent] }).compileComponents();
  });

  function createPanel() {
    const fixture = TestBed.createComponent(CrewPanelComponent);
    const crews = buildProgramForm().controls.crews;
    fixture.componentRef.setInput('crews', crews);
    return { fixture, crews };
  }

  it('parte con una fila y protege su accion de eliminar', async () => {
    const { fixture, crews } = createPanel();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const remove = host.querySelector<HTMLButtonElement>('[aria-label="Eliminar tripulante 1"]');

    expect(crews.length).toBe(1);
    expect(host.querySelectorAll('article')).toHaveLength(1);
    expect(remove?.disabled).toBe(true);
  });

  it('agrega al final y elimina la fila elegida', async () => {
    const { fixture, crews } = createPanel();
    await fixture.whenStable();
    const firstId = crews.at(0).controls.id.value;

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.add-crew-button')!
      .click();
    await fixture.whenStable();

    expect(crews.length).toBe(2);
    expect(crews.at(0).controls.id.value).toBe(firstId);
    expect(crews.at(1).controls.id.value).not.toBe(firstId);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="Eliminar tripulante 2"]')!
      .click();
    await fixture.whenStable();

    expect(crews.length).toBe(1);
    expect(crews.at(0).controls.id.value).toBe(firstId);
  });

  it('ofrece las tres monedas del contrato', async () => {
    const { fixture } = createPanel();
    await fixture.whenStable();
    const select = fixture.debugElement.query(By.directive(Select)).componentInstance as Select;

    expect(select.options()!.map((option: { value: string }) => option.value)).toEqual([
      'CLP',
      'USD',
      'BRL',
    ]);
  });

  it('muestra un error asociado para un documento invalido', async () => {
    const { fixture, crews } = createPanel();
    const document = crews.at(0).controls.documentId;
    document.setValue('ABC');
    document.markAsTouched();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('#crew-0-document')?.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('#crew-0-document')?.getAttribute('aria-describedby')).toBe(
      'crew-0-document-error',
    );
    expect(host.textContent).toContain('Ingresa un RUT, DNI o CPF válido.');
  });

  it('rechaza decimales en CLP y los admite en monedas extranjeras', async () => {
    const { fixture, crews } = createPanel();
    const row = crews.at(0);
    row.patchValue({ dailyPrice: 10.5, currency: 'CLP' });
    row.controls.dailyPrice.markAsTouched();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(row.hasError('clpIntegerPrice')).toBe(true);
    expect(host.textContent).toContain('El precio en CLP debe ser un número entero.');

    row.controls.currency.setValue('USD');
    await fixture.whenStable();

    expect(row.hasError('clpIntegerPrice')).toBe(false);
    expect(row.controls.dailyPrice.valid).toBe(true);
  });
});

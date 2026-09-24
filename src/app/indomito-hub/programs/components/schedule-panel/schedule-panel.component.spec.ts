import { TestBed } from '@angular/core/testing';

import { buildProgramForm } from '../../forms/program-form.builder';
import { SchedulePanelComponent } from './schedule-panel.component';

describe('SchedulePanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SchedulePanelComponent] }).compileComponents();
  });

  function createPanel(options: { paying?: number | null; warning?: boolean } = {}) {
    const fixture = TestBed.createComponent(SchedulePanelComponent);
    const group = buildProgramForm(() => 'row-id').controls.schedule;

    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('payingPassengers', options.paying ?? null);
    fixture.componentRef.setInput('nightsExceedDays', options.warning ?? false);

    return { fixture, group };
  }

  it('muestra días y noches editables junto con las cantidades del grupo', async () => {
    const { fixture, group } = createPanel({ paying: 27 });
    group.patchValue({ totalDays: 8, totalNights: 7 });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector<HTMLInputElement>('#program-total-days')?.value).toBe('8');
    expect(host.querySelector('#program-total-nights')).not.toBeNull();
    expect(host.querySelector('#program-total-passengers')).not.toBeNull();
    expect(host.querySelector('#program-free-passengers')).not.toBeNull();
    expect(host.textContent).toContain('27 pasajeros pagantes');
  });

  it('enlaza los días totales editables al grupo recibido', async () => {
    const { fixture, group } = createPanel();
    await fixture.whenStable();
    group.controls.totalDays.setValue(12);
    expect(group.controls.totalDays.value).toBe(12);
  });

  it('exige al menos un pasajero pagante sin duplicar el mensaje', async () => {
    const { fixture, group } = createPanel();
    group.patchValue({ totalPassengers: 10, freePassengers: 10 });
    group.controls.freePassengers.markAsTouched();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(group.hasError('payingPassenger')).toBe(true);
    expect(host.querySelectorAll('#program-paying-passengers-error')).toHaveLength(1);
    expect(host.querySelector('#program-free-passengers')?.getAttribute('aria-describedby')).toBe(
      'program-paying-passengers-error',
    );
  });

  it('anuncia la incoherencia de noches sin volver invalido un calendario valido', async () => {
    const { fixture, group } = createPanel({ paying: 10, warning: true });
    group.setValue({
      totalDays: 2,
      totalNights: 3,
      totalPassengers: 10,
      freePassengers: 0,
    });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(group.valid).toBe(true);
    expect(host.querySelector('[aria-live="polite"] #program-nights-warning')).not.toBeNull();
    expect(host.querySelector('#program-total-nights')?.getAttribute('aria-describedby')).toContain(
      'program-nights-warning',
    );
  });
});

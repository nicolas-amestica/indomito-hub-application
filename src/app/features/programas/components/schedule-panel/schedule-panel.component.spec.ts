import { TestBed } from '@angular/core/testing';

import { buildProgramForm } from '../../forms/program-form.builder';
import { SchedulePanelComponent } from './schedule-panel.component';

describe('SchedulePanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SchedulePanelComponent] }).compileComponents();
  });

  function createPanel(options: { totalDays?: number; paying?: number | null; warning?: boolean } = {}) {
    const fixture = TestBed.createComponent(SchedulePanelComponent);
    const group = buildProgramForm(() => 'row-id').controls.schedule;

    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('totalDays', options.totalDays ?? 0);
    fixture.componentRef.setInput('payingPassengers', options.paying ?? null);
    fixture.componentRef.setInput('nightsExceedDays', options.warning ?? false);

    return { fixture, group };
  }

  it('muestra las fechas, las cantidades y los dias derivados de solo lectura', async () => {
    const { fixture } = createPanel({ totalDays: 8, paying: 27 });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector<HTMLInputElement>('#program-start-date')?.type).toBe('date');
    expect(host.querySelector<HTMLInputElement>('#program-end-date')?.type).toBe('date');
    expect(host.querySelector<HTMLInputElement>('#program-total-days')?.readOnly).toBe(true);
    expect(host.querySelector<HTMLInputElement>('#program-total-days')?.value).toBe('8');
    expect(host.querySelector('#program-total-nights')).not.toBeNull();
    expect(host.querySelector('#program-total-passengers')).not.toBeNull();
    expect(host.querySelector('#program-free-passengers')).not.toBeNull();
    expect(host.textContent).toContain('27 pasajeros pagantes');
  });

  it('enlaza el rango ISO al grupo recibido', async () => {
    const { fixture, group } = createPanel();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const start = host.querySelector<HTMLInputElement>('#program-start-date')!;
    const end = host.querySelector<HTMLInputElement>('#program-end-date')!;

    start.value = '2027-03-01';
    start.dispatchEvent(new Event('input'));
    end.value = '2027-03-08';
    end.dispatchEvent(new Event('input'));

    expect(group.controls.startDate.value).toBe('2027-03-01');
    expect(group.controls.endDate.value).toBe('2027-03-08');
  });

  it('muestra el error de orden del rango y lo asocia a la fecha de termino', async () => {
    const { fixture, group } = createPanel();
    group.patchValue({ startDate: '2027-03-08', endDate: '2027-03-01' });
    group.controls.endDate.markAsTouched();
    await fixture.whenStable();
    const end = (fixture.nativeElement as HTMLElement).querySelector('#program-end-date');

    expect(group.hasError('dateRangeOrder')).toBe(true);
    expect(end?.getAttribute('aria-invalid')).toBe('true');
    expect(end?.getAttribute('aria-describedby')).toBe('program-date-range-order-error');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'La fecha de término no puede ser anterior a la fecha de inicio.',
    );
  });

  it('informa cuando el rango excede la duracion maxima', async () => {
    const { fixture, group } = createPanel();
    group.patchValue({ startDate: '2027-01-01', endDate: '2027-04-12' });
    group.controls.endDate.markAsTouched();
    await fixture.whenStable();

    expect(group.hasError('dateRangeMaxDays')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'La duración máxima permitida es de 100 días.',
    );
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
    const { fixture, group } = createPanel({ totalDays: 2, paying: 10, warning: true });
    group.setValue({
      startDate: '2027-03-01',
      endDate: '2027-03-02',
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

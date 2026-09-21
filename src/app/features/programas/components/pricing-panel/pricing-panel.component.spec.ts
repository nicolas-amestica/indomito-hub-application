import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { LOCALE_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Select } from 'primeng/select';

import { buildProgramForm } from '../../forms/program-form.builder';
import type { ExchangeSnapshot } from '../../interfaces/program.interface';
import { PricingPanelComponent } from './pricing-panel.component';

registerLocaleData(localeEsCl);

const snapshot: ExchangeSnapshot = {
  date: '2027-03-01',
  usdToClp: 1_000,
  brlToClp: 200,
  isFallback: false,
};

describe('PricingPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricingPanelComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CL' }],
    }).compileComponents();
  });

  function createPanel(options: { warning?: boolean; floor?: number | null } = {}) {
    const fixture = TestBed.createComponent(PricingPanelComponent);
    const group = buildProgramForm(() => 'row-id').controls.pricing;
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('snapshot', snapshot);
    fixture.componentRef.setInput('belowUtilityFloor', options.warning ?? false);
    fixture.componentRef.setInput('minimumUtilityRate', options.floor ?? null);
    return { fixture, group };
  }

  it('ofrece incrementos con los pasos y topes definidos para cada divisa', async () => {
    const { fixture } = createPanel();
    await fixture.whenStable();
    const selects = fixture.debugElement
      .queryAll(By.directive(Select))
      .map((item) => item.componentInstance as Select);

    expect(selects).toHaveLength(4);
    expect(selects[0].options()!.map((option: { value: number }) => option.value)).toEqual(
      Array.from({ length: 41 }, (_, index) => index * 5),
    );
    expect(selects[1].options()!.map((option: { value: number }) => option.value)).toEqual(
      Array.from({ length: 9 }, (_, index) => index * 5),
    );
    expect(selects[2].options()).toHaveLength(101);
    expect(selects[3].options()).toHaveLength(101);
  });

  it('muestra la tasa del dia, la efectiva y el porcentaje de resguardo', async () => {
    const { fixture, group } = createPanel();
    group.patchValue({ usdIncreaseCLP: 60, brlIncreaseCLP: 20 });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('1.000');
    expect(host.textContent).toContain('1.060');
    expect(host.textContent).toContain('6,0 %');
    expect(host.textContent).toContain('220');
    expect(host.textContent).toContain('10,0 %');
  });

  it('mantiene obligatorios los cuatro selectores cuando no hay precarga', async () => {
    const { fixture, group } = createPanel();
    group.markAllAsTouched();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(group.invalid).toBe(true);
    expect(host.querySelectorAll('[id$="-error"]')).toHaveLength(4);
    expect(host.querySelector('#program-usd-increase')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('anuncia el piso de utilidad como advertencia sin invalidar valores permitidos', async () => {
    const { fixture, group } = createPanel({ warning: true, floor: 20 });
    group.setValue({ usdIncreaseCLP: 60, brlIncreaseCLP: 20, utilityRate: 15, rechargeRate: 5 });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(group.valid).toBe(true);
    expect(
      host.querySelector('[aria-live="polite"] #program-utility-floor-warning'),
    ).not.toBeNull();
    expect(host.textContent).toContain('20 %');
  });
});

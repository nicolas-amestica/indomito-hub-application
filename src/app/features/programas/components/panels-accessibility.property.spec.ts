import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import fc from 'fast-check';

import { buildProgramForm } from '../forms/program-form.builder';
import type { CatalogOption, DestinationOption } from '../interfaces/catalog.interface';
import type { ExchangeSnapshot } from '../interfaces/program.interface';
import { CrewPanelComponent } from './crew-panel/crew-panel.component';
import { GeneralDataPanelComponent } from './general-data-panel/general-data-panel.component';
import { PricingPanelComponent } from './pricing-panel/pricing-panel.component';
import { SchedulePanelComponent } from './schedule-panel/schedule-panel.component';
import { ServicesPanelComponent } from './services-panel/services-panel.component';

@Component({
  imports: [
    CrewPanelComponent,
    GeneralDataPanelComponent,
    PricingPanelComponent,
    SchedulePanelComponent,
    ServicesPanelComponent,
  ],
  template: `
    <app-general-data-panel
      [group]="form.controls.generals"
      [plans]="plans"
      [seasons]="seasons"
      [destinations]="destinations"
    />
    <app-schedule-panel [group]="form.controls.schedule" />
    <app-pricing-panel [group]="form.controls.pricing" [snapshot]="snapshot" />
    <app-crew-panel [crews]="form.controls.crews" />
    <app-services-panel [services]="form.controls.services" />
  `,
})
class AccessiblePanelsHost {
  readonly form = buildProgramForm();
  readonly plans: CatalogOption[] = [{ id: 'plan', display: 'Plan', order: 1 }];
  readonly seasons: CatalogOption[] = [{ id: '2027', display: '2027', order: 1 }];
  readonly destinations: DestinationOption[] = [
    { id: 'destino', display: 'Destino', order: 1, budgetTemplateId: 'default' },
  ];
  readonly snapshot: ExchangeSnapshot = {
    date: '2027-03-01',
    usdToClp: 1_000,
    brlToClp: 200,
    isFallback: false,
  };
}

describe('paneles del formulario · accesibilidad', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccessiblePanelsHost] }).compileComponents();
  });

  it('Feature: program-form, Property 40: Todo control tiene nombre accesible y todo campo tiene etiqueta', async () => {
    const fixture = TestBed.createComponent(AccessiblePanelsHost);
    await fixture.whenStable();
    let renderedCrewCount = 1;
    let renderedServiceCount = 1;

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 10 }),
        async (crewCount, serviceCount) => {
          let host = fixture.nativeElement as HTMLElement;
          changeRowCount(host, 'crew', renderedCrewCount, crewCount);
          changeRowCount(host, 'service', renderedServiceCount, serviceCount);
          renderedCrewCount = crewCount;
          renderedServiceCount = serviceCount;
          await fixture.whenStable();

          host = fixture.nativeElement as HTMLElement;
          const fields = host.querySelectorAll<HTMLElement>(
            'input:not([type="hidden"]), textarea, [role="combobox"]',
          );
          const buttons = host.querySelectorAll<HTMLButtonElement>('button');

          expect(fields).toHaveLength(16 + crewCount * 4 + serviceCount * 4);
          for (const field of fields) {
            expect(hasVisibleLabel(field, host)).toBe(true);
            expect(hasAccessibleName(field, host)).toBe(true);
          }
          for (const button of buttons) {
            expect(hasText(button) || hasTextAttribute(button, 'aria-label')).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 15_000);
});

function changeRowCount(
  host: HTMLElement,
  kind: 'crew' | 'service',
  current: number,
  target: number,
): void {
  const difference = target - current;
  const selector =
    difference > 0
      ? `.${kind === 'crew' ? 'add-crew' : 'add-service'}-button`
      : `[aria-label="Eliminar ${kind === 'crew' ? 'tripulante' : 'servicio'} 1"]`;
  const button = host.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();

  for (let index = 0; index < Math.abs(difference); index++) button!.click();
}

function hasVisibleLabel(field: HTMLElement, host: HTMLElement): boolean {
  if (field.id === '') return false;
  return Array.from(host.querySelectorAll<HTMLLabelElement>('label')).some(
    (label) => label.htmlFor === field.id && hasText(label),
  );
}

function hasAccessibleName(field: HTMLElement, host: HTMLElement): boolean {
  if (hasTextAttribute(field, 'aria-label')) return true;

  const labelledBy = field.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
  if (
    labelledBy.some((id) => {
      const label = host.querySelector<HTMLElement>(`#${id}`);
      return label !== null && hasText(label);
    })
  ) {
    return true;
  }

  return hasVisibleLabel(field, host);
}

function hasText(element: HTMLElement): boolean {
  return (element.textContent ?? '').trim().length > 0;
}

function hasTextAttribute(element: HTMLElement, attribute: string): boolean {
  return (element.getAttribute(attribute) ?? '').trim().length > 0;
}

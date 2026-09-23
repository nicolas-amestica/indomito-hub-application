import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { LOCALE_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Dialog } from 'primeng/dialog';

import type { EffectiveRates, Program } from '../../interfaces/program.interface';
import { PreviewDialogComponent } from './preview-dialog.component';

registerLocaleData(localeEsCl);

const RATES: EffectiveRates = { CLP: 1, USD: 1_050, BRL: 210 };

const PROGRAM: Program = {
  generals: {
    name: 'Brasil 2027',
    description: 'Gira pedagógica',
    plan: { id: 'plan-1', display: 'Gira de estudio' },
    season: { id: '2027', display: '2027' },
    destination: { id: 'brx', display: 'Brasil' },
    departureCity: 'Santiago',
  },
  schedule: {
    totalDays: 7,
    totalNights: 6,
    totalPassengers: 30,
    freePassengers: 2,
    payingPassengers: 28,
  },
  pricing: {
    usdIncreaseCLP: 50,
    brlIncreaseCLP: 10,
    utilityRate: 20,
    rechargeRate: 5,
    exchange: {
      date: '2027-03-01',
      usdToClp: 1_000,
      brlToClp: 200,
      isFallback: false,
    },
  },
  crews: [
    {
      name: 'Coordinador',
      documentId: '12345678',
      dailyPrice: 45_000,
      currency: 'CLP',
      baseAmount: 315_000,
      amountCLP: 315_000,
    },
  ],
  services: [
    {
      name: 'Hotel',
      chargeType: 'per_passenger_night',
      unitPrice: 55,
      currency: 'USD',
      baseAmount: 9_900,
      amountCLP: 10_395_000,
    },
  ],
  totals: {
    subtotalCLP: 315_000,
    subtotalUSD: 9_900,
    subtotalBRL: 0,
    netCLP: 10_710_000,
    utilityCLP: 2_142_000,
    netWithUtilityCLP: 12_852_000,
    netWithUtilityPerPassengerCLP: 459_000,
    rechargeCLP: 642_600,
    totalCLP: 13_494_600,
    totalPerPassengerCLP: 482_000,
  },
};

describe('PreviewDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewDialogComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'es-CL' }],
    }).compileComponents();
  });

  function createPreview(options: { busy?: boolean; fallbackDate?: string | null } = {}) {
    const fixture = TestBed.createComponent(PreviewDialogComponent);
    fixture.componentRef.setInput('program', PROGRAM);
    fixture.componentRef.setInput('effectiveRates', RATES);
    fixture.componentRef.setInput('fallbackDate', options.fallbackDate ?? null);
    fixture.componentRef.setInput('busy', options.busy ?? false);
    fixture.componentRef.setInput('visible', true);
    return fixture;
  }

  it('muestra el programa completo desde el estado recibido', async () => {
    const fixture = createPreview();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Brasil 2027');
    expect(host.textContent).toContain('Gira de estudio');
    expect(host.textContent).toContain('Coordinador');
    expect(host.textContent).toContain('Hotel');
    expect(host.textContent).toContain('13.494.600 CLP');
    expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(10);
  });

  it('configura el dialogo modal con foco retenido, Escape y foco inicial', async () => {
    const fixture = createPreview();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(Dialog)).componentInstance as Dialog;

    expect(dialog.modal()).toBe(true);
    expect(dialog.focusTrap()).toBe(true);
    expect(dialog.focusOnShow()).toBe(true);
    expect(dialog.closeOnEscape()).toBe(true);
  });

  it('emite las tres acciones sin cerrar la previsualización', async () => {
    const fixture = createPreview();
    const excel = vi.fn();
    const pdf = vi.fn();
    const favorite = vi.fn();
    fixture.componentInstance.excelRequested.subscribe(excel);
    fixture.componentInstance.pdfRequested.subscribe(pdf);
    fixture.componentInstance.favoriteRequested.subscribe(favorite);
    await fixture.whenStable();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];

    buttonNamed(buttons, 'Exportar a Excel').click();
    buttonNamed(buttons, 'Exportar presupuesto').click();
    buttonNamed(buttons, 'Guardar favorito').click();
    await fixture.whenStable();

    expect(excel).toHaveBeenCalledOnce();
    expect(pdf).toHaveBeenCalledOnce();
    expect(favorite).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('anuncia la carga y deshabilita todas las acciones mientras procesa', async () => {
    const fixture = createPreview({ busy: true });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).toContain('Procesando la solicitud…');
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('button')].every((button) => button.disabled),
    ).toBe(true);
  });

  it('reutiliza el aviso cuando el snapshot es de respaldo', async () => {
    const fixture = createPreview({ fallbackDate: '2027-02-28' });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-fallback-rates-notice')).not.toBeNull();
    expect(host.textContent).toContain('28 de febrero de 2027');
  });
});

function buttonNamed(buttons: HTMLButtonElement[], text: string): HTMLButtonElement {
  return buttons.find((button) => button.textContent?.trim() === text)!;
}

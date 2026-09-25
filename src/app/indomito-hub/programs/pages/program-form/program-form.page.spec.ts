import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import fc from 'fast-check';
import { MessageService } from 'primeng/api';
import { map, NEVER, of, Subject, throwError, type Observable } from 'rxjs';

import { PreviewDialogComponent } from '../../components/preview-dialog/preview-dialog.component';
import { FavoritesPanelComponent } from '../../components/favorites-panel/favorites-panel.component';
import { FAVORITES_AVAILABLE } from '../../tokens/favorites-availability.token';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ExcelExporter } from '../../exporters/excel-exporter';
import { EXCEL_DETAIL_HEADERS, type ExcelLayout } from '../../exporters/excel-layout';
import type { CatalogResponse } from '../../interfaces/catalog.interface';
import type { ProgramFormConfiguration } from '../../interfaces/program-form-configuration.interface';
import type { Favorite } from '../../interfaces/favorite.interface';
import type { ExchangeSnapshot } from '../../interfaces/program.interface';
import type { BudgetRequest } from '../../interfaces/program.interface';
import { BudgetPdfService } from '../../services/budget-pdf.service';
import { ProgramFormConfigurationService } from '../../services/program-form-configuration.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { FavoritesService } from '../../services/favorites.service';
import { ProgramFormStore } from '../../stores/program-form.store';
import { ProgramFormPage } from './program-form.page';

describe('ProgramFormPage', () => {
  let exchangeResponse$: Observable<ExchangeSnapshot>;
  let catalogResponse$: Observable<CatalogResponse>;
  let getSnapshot: ReturnType<typeof vi.fn>;
  let getFormConfiguration: ReturnType<typeof vi.fn>;
  let formConfiguration: ProgramFormConfiguration;
  let exportExcelFile: ReturnType<typeof vi.fn>;
  let generateBudgetPdf: ReturnType<typeof vi.fn>;
  let downloadBudgetPdf: ReturnType<typeof vi.fn>;
  let listFavorites: ReturnType<typeof vi.fn>;
  let createFavorite: ReturnType<typeof vi.fn>;
  let updateFavorite: ReturnType<typeof vi.fn>;
  let deleteFavorite: ReturnType<typeof vi.fn>;
  let notifyError: ReturnType<typeof vi.fn>;
  let notifyWarn: ReturnType<typeof vi.fn>;
  let notifySuccess: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    exchangeResponse$ = NEVER;
    catalogResponse$ = NEVER;
    getSnapshot = vi.fn(() => exchangeResponse$);
    formConfiguration = defaultFormConfiguration();
    getFormConfiguration = vi.fn(() =>
      catalogResponse$ === NEVER
        ? NEVER
        : catalogResponse$.pipe(map((catalogs) => ({ ...formConfiguration, catalogs }))),
    );
    exportExcelFile = vi.fn().mockResolvedValue(undefined);
    generateBudgetPdf = vi.fn(() => of(new Blob([], { type: 'application/pdf' })));
    downloadBudgetPdf = vi.fn();
    listFavorites = vi.fn(() => of([]));
    createFavorite = vi.fn();
    updateFavorite = vi.fn();
    deleteFavorite = vi.fn();
    notifyError = vi.fn();
    notifyWarn = vi.fn();
    notifySuccess = vi.fn();
    await TestBed.configureTestingModule({
      imports: [ProgramFormPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: ProgramFormConfigurationService, useValue: { get: getFormConfiguration } },
        { provide: ExchangeRateService, useValue: { getSnapshot } },
        { provide: ExcelExporter, useValue: { export: exportExcelFile } },
        {
          provide: BudgetPdfService,
          useValue: { generate: generateBudgetPdf, download: downloadBudgetPdf },
        },
        {
          provide: FavoritesService,
          useValue: {
            list: listFavorites,
            create: createFavorite,
            update: updateFavorite,
            delete: deleteFavorite,
          },
        },
        { provide: FAVORITES_AVAILABLE, useValue: true },
        {
          provide: NotificationService,
          useValue: { error: notifyError, warn: notifyWarn, success: notifySuccess },
        },
      ],
    }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(ProgramFormPage);

    expect(fixture.componentInstance).toBeTruthy();
  });

  // Requirement 1.1: el título y la bajada son texto literal de la spec.
  it('muestra el titulo y la bajada del formulario', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Crear Programa');
    expect(host.querySelectorAll('header p')[1]?.textContent?.trim()).toBe(
      'Completa el formulario para crear un nuevo programa de viajes.',
    );
  });

  it('aloja el contenedor de toasts de la feature', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('p-toast')).not.toBeNull();
  });

  it('monta el panel de datos generales con el formulario de la feature', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-general-data-panel')).not.toBeNull();
    expect(host.querySelector('#program-name')).not.toBeNull();
  });

  it('monta el panel de duración con los días editables inicialmente vacíos', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-schedule-panel')).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>('#program-total-days')?.value).toBe('');
  });

  it('monta los paneles de precio, tripulacion y servicios sobre el formulario', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-pricing-panel')).not.toBeNull();
    expect(host.querySelector('app-crew-panel')).not.toBeNull();
    expect(host.querySelector('app-services-panel')).not.toBeNull();
    expect(host.querySelector('#program-usd-increase')).not.toBeNull();
    expect(host.querySelector('#crew-0-name')).not.toBeNull();
    expect(host.querySelector('#service-0-name')).not.toBeNull();
    expect(host.querySelectorAll('p-panel')).toHaveLength(5);
  });

  it('solicita tasas y catálogos exactamente una vez y muestra sus estados de carga', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(getSnapshot).toHaveBeenCalledOnce();
    expect(getFormConfiguration).toHaveBeenCalledOnce();
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).toContain('Obteniendo tasas vigentes…');
  });

  it('permite reintentar las tasas después de un error', async () => {
    exchangeResponse$ = throwError(() => new Error('rates unavailable'));
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No se pudieron obtener los tipos de cambio.');

    exchangeResponse$ = of(freshSnapshot());
    buttonNamed(host, 'Reintentar tasas').click();
    await fixture.whenStable();

    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('1.000 CLP');
  });

  it('permite reintentar los catálogos después de un error', async () => {
    catalogResponse$ = throwError(() => new Error('catalog unavailable'));
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No se pudieron obtener los catálogos del programa.');

    catalogResponse$ = of(emptyCatalog());
    buttonNamed(host, 'Reintentar catálogos').click();
    await fixture.whenStable();

    expect(getFormConfiguration).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain('No se pudieron obtener los catálogos del programa.');
  });

  it('muestra el aviso reutilizable cuando las tasas provienen del respaldo', async () => {
    exchangeResponse$ = of({ ...freshSnapshot(), isFallback: true, source: 'banco-central' });
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-fallback-rates-notice')).not.toBeNull();
    expect(host.textContent).toContain('Estás cotizando con tasas de respaldo.');
  });

  it('carga los favoritos cada vez que abre el panel', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    buttonNamed(host, 'Favoritos').click();
    await fixture.whenStable();
    buttonNamed(host, 'Cerrar favoritos').click();
    await fixture.whenStable();
    buttonNamed(host, 'Favoritos').click();
    await fixture.whenStable();

    expect(listFavorites).toHaveBeenCalledTimes(2);
    expect(listFavorites).toHaveBeenNthCalledWith(1, 'programa');
  });

  it('muestra el aviso y deshabilita favoritos cuando el ambiente no los expone', async () => {
    TestBed.overrideProvider(FAVORITES_AVAILABLE, { useValue: false });
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain(
      'El guardado de favoritos no está disponible en este ambiente.',
    );
    expect(buttonNamed(host, 'Favoritos').disabled).toBe(true);
    expect(listFavorites).not.toHaveBeenCalled();
  });

  it('carga el favorito, cierra el panel y recalcula con las tasas vigentes', async () => {
    const favorite = sampleFavorite();
    exchangeResponse$ = of(freshSnapshot());
    catalogResponse$ = of(catalogWithOptions());
    listFavorites.mockReturnValueOnce(of([favorite]));
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    buttonNamed(host, 'Favoritos').click();
    await fixture.whenStable();
    const panel = fixture.debugElement.query(By.directive(FavoritesPanelComponent))
      .componentInstance as FavoritesPanelComponent;

    panel.favoriteSelected.emit(favorite);
    await fixture.whenStable();

    expect(store.form.controls.generals.controls.name.value).toBe('Brasil 2027');
    expect(store.nightsSource()).toBe('user');
    expect(store.program()?.pricing.exchange).toEqual(freshSnapshot());
    expect(store.rows()[1].effectiveRate).toBe(1_050);
    expect(buttonNamed(host, 'Favoritos')).toBeTruthy();
    expect(notifySuccess).toHaveBeenCalledWith(
      'El favorito se cargó con los tipos de cambio vigentes.',
    );
  });

  it('carga la tabla diferida cuando aparece el primer item válido', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);

    store.form.controls.schedule.setValue({
      totalDays: 7,
      totalNights: 6,
      totalPassengers: 30,
      freePassengers: 2,
    });
    store.form.controls.pricing.setValue({
      usdIncreaseCLP: 50,
      brlIncreaseCLP: 10,
      utilityRate: 20,
      rechargeRate: 5,
    });
    const crew = store.form.controls.crews.at(0);
    crew.setValue({
      id: crew.controls.id.value,
      name: 'Coordinador',
      documentId: '12345678',
      dailyPrice: 45_000,
      currency: 'CLP',
    });

    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-summary-table')).not.toBeNull();
    expect(host.querySelectorAll('[data-summary-row]')).toHaveLength(1);
    expect(host.textContent).toContain('Coordinador');
  });

  it('Feature: program-form, Property 19: Sin tipos de cambio no se puede previsualizar', async () => {
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    await fixture.whenStable();

    await fc.assert(
      fc.asyncProperty(validProgramName(), async (name) => {
        completeValidForm(store, name);
        await fixture.whenStable();
        const preview = buttonNamed(fixture.nativeElement as HTMLElement, 'Previsualizar');

        expect(store.form.valid).toBe(true);
        expect(store.canPreview()).toBe(false);
        expect(preview.disabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: program-form, Property 20: Un solo campo obligatorio inválido deshabilita la previsualización', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    await fixture.whenStable();

    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...requiredFieldInvalidators), async (invalidate) => {
        completeValidForm(store);
        invalidate(store);
        await fixture.whenStable();
        const preview = buttonNamed(fixture.nativeElement as HTMLElement, 'Previsualizar');

        expect(store.canPreview()).toBe(false);
        expect(preview.disabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: program-form, Property 22: Cerrar la previsualización o fallar una acción conserva el formulario', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    await fixture.whenStable();
    const pageState = fixture.componentInstance as unknown as {
      previewOpen: WritableSignal<boolean>;
      previewBusy: WritableSignal<boolean>;
    };

    fc.assert(
      fc.property(validProgramName(), fc.boolean(), (name, closeDialog) => {
        completeValidForm(store, name);
        const before = store.form.getRawValue();
        pageState.previewOpen.set(true);

        if (closeDialog) {
          pageState.previewOpen.set(false);
        } else {
          pageState.previewBusy.set(true);
          pageState.previewBusy.set(false);
        }

        expect(store.form.getRawValue()).toEqual(before);
      }),
      { numRuns: 100 },
    );
  });

  it('devuelve el foco al botón que abrió la previsualización al cerrarla', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    await fixture.whenStable();
    const previewTrigger = buttonNamed(fixture.nativeElement as HTMLElement, 'Previsualizar');
    previewTrigger.click();
    await fixture.whenStable();
    const preview = fixture.debugElement.query(By.directive(PreviewDialogComponent))
      .componentInstance as PreviewDialogComponent;

    preview.visible.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(previewTrigger);
  });

  it('expone la exportación junto al resumen y entrega todas las filas aunque estén filtradas', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    store.searchTerm.set('sin coincidencias');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(store.visibleRows()).toHaveLength(0);
    buttonNamed(host, 'Exportar a Excel').click();
    await fixture.whenStable();

    expect(exportExcelFile).toHaveBeenCalledOnce();
    const layout = exportExcelFile.mock.calls[0][0] as ExcelLayout;
    const detailHeaderIndex = layout.rows.findIndex(
      (row) => row.map((cell) => cell?.value).join('|') === EXCEL_DETAIL_HEADERS.join('|'),
    );
    const exportedRows = layout.rows.slice(
      detailHeaderIndex + 1,
      detailHeaderIndex + 1 + store.rows().length,
    );
    expect(exportedRows.map((row) => row[0]?.value)).toEqual(store.rows().map((row) => row.name));
  });

  it('deriva los escenarios configurados y descarga el presupuesto PDF', async () => {
    exchangeResponse$ = of(freshSnapshot());
    catalogResponse$ = of({
      ...emptyCatalog(),
    });
    formConfiguration = { ...defaultFormConfiguration(), scenarioOffsets: [-10, 0, 5] };
    const pdf = new Blob(['presupuesto'], { type: 'application/pdf' });
    generateBudgetPdf.mockReturnValueOnce(of(pdf));
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    await fixture.whenStable();

    buttonNamed(fixture.nativeElement as HTMLElement, 'Exportar presupuesto').click();
    await fixture.whenStable();

    expect(generateBudgetPdf).toHaveBeenCalledOnce();
    const request = generateBudgetPdf.mock.calls[0][0] as BudgetRequest;
    expect(request).toMatchObject({
      programName: 'Brasil 2027',
      destination: {
        id: 'brx',
        display: 'Brasil',
        order: 1,
        budgetTemplateId: 'brochure-default',
      },
      departureCity: 'Santiago',
      totalDays: 7,
      totalNights: 6,
      serviceNames: ['Hotel'],
    });
    expect(request.scenarios.map(({ totalPassengers }) => totalPassengers)).toEqual([20, 30, 35]);
    expect(request.scenarios.every(({ pricePerPassengerCLP }) => pricePerPassengerCLP > 0)).toBe(
      true,
    );
    expect(downloadBudgetPdf).toHaveBeenCalledWith(pdf, 'Brasil 2027');
  });

  it('solicita seleccionar destino y omite el endpoint de presupuesto', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    store.form.controls.generals.controls.destination.setValue(null);
    await fixture.whenStable();

    buttonNamed(fixture.nativeElement as HTMLElement, 'Exportar presupuesto').click();
    await fixture.whenStable();

    expect(notifyWarn).toHaveBeenCalledWith(
      'Selecciona un destino antes de exportar el presupuesto.',
    );
    expect(generateBudgetPdf).not.toHaveBeenCalled();
  });

  it('notifica un error no HTTP y rehabilita la exportación PDF', async () => {
    exchangeResponse$ = of(freshSnapshot());
    generateBudgetPdf.mockReturnValueOnce(throwError(() => new Error('pdf failed')));
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    buttonNamed(host, 'Exportar presupuesto').click();
    await fixture.whenStable();

    expect(notifyError).toHaveBeenCalledWith(
      'No se pudo exportar el presupuesto. Inténtalo nuevamente.',
    );
    expect(buttonNamed(host, 'Exportar presupuesto').disabled).toBe(false);
  });

  it('conecta la exportación PDF de la previsualización y bloquea todas las exportaciones', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const response = new Subject<Blob>();
    generateBudgetPdf.mockReturnValueOnce(response);
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    await fixture.whenStable();
    buttonNamed(fixture.nativeElement as HTMLElement, 'Previsualizar').click();
    await fixture.whenStable();
    const preview = fixture.debugElement.query(By.directive(PreviewDialogComponent))
      .componentInstance as PreviewDialogComponent;

    preview.pdfRequested.emit();
    await fixture.whenStable();

    expect(generateBudgetPdf).toHaveBeenCalledOnce();
    expect(
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => button.textContent?.includes('Exportar'))
        .every((button) => button.disabled),
    ).toBe(true);

    response.next(new Blob([], { type: 'application/pdf' }));
    response.complete();
    await fixture.whenStable();
    expect(
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => button.textContent?.includes('Exportar'))
        .some((button) => !button.disabled),
    ).toBe(true);
  });

  it('guarda desde la previsualización los totales auditables sin enviar el snapshot de tasas', async () => {
    exchangeResponse$ = of(freshSnapshot());
    const saved = sampleFavorite();
    createFavorite.mockReturnValueOnce(of(saved));
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    await fixture.whenStable();
    buttonNamed(fixture.nativeElement as HTMLElement, 'Previsualizar').click();
    await fixture.whenStable();
    const preview = fixture.debugElement.query(By.directive(PreviewDialogComponent))
      .componentInstance as PreviewDialogComponent;
    const favoritesPanel = fixture.debugElement.query(By.directive(FavoritesPanelComponent))
      .componentInstance as FavoritesPanelComponent;

    preview.favoriteRequested.emit();
    await fixture.whenStable();
    favoritesPanel.saveSubmitted.emit('Mi favorito');
    await fixture.whenStable();

    expect(createFavorite).toHaveBeenCalledOnce();
    const content = createFavorite.mock.calls[0][0].content as Record<string, unknown> & {
      pricing: Record<string, unknown>;
    };
    expect(content['totals']).toMatchObject({
      vatRate: 19,
      crewWithholdingRate: 15.25,
      vatCLP: expect.any(Number),
      crewWithholdingCLP: expect.any(Number),
    });
    expect(content.pricing).not.toHaveProperty('exchange');
    expect(content['rateOrigin']).toEqual({
      date: '2027-03-01',
      source: 'banco-central',
      isFallback: false,
    });
    expect(notifySuccess).toHaveBeenCalledWith('El favorito se guardó correctamente.');
  });

  it('deshabilita las acciones durante la exportación solicitada desde la previsualización', async () => {
    exchangeResponse$ = of(freshSnapshot());
    let finishExport!: () => void;
    exportExcelFile.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishExport = resolve;
      }),
    );
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    await fixture.whenStable();
    buttonNamed(fixture.nativeElement as HTMLElement, 'Previsualizar').click();
    await fixture.whenStable();
    const preview = fixture.debugElement.query(By.directive(PreviewDialogComponent))
      .componentInstance as PreviewDialogComponent;

    preview.excelRequested.emit();
    fixture.detectChanges();

    expect(exportExcelFile).toHaveBeenCalledOnce();
    expect(
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => button.textContent?.includes('Exportar'))
        .every((button) => button.disabled),
    ).toBe(true);

    finishExport();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => button.textContent?.includes('Exportar'))
        .some((button) => !button.disabled),
    ).toBe(true);
  });

  it('notifica el error y rehabilita la exportación cuando falla la descarga', async () => {
    exchangeResponse$ = of(freshSnapshot());
    exportExcelFile.mockRejectedValueOnce(new Error('download failed'));
    const fixture = TestBed.createComponent(ProgramFormPage);
    const store = fixture.debugElement.injector.get(ProgramFormStore);
    completeValidForm(store);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    buttonNamed(host, 'Exportar a Excel').click();
    await fixture.whenStable();

    expect(notifyError).toHaveBeenCalledWith(
      'No se pudo exportar el detalle a Excel. Inténtalo nuevamente.',
    );
    expect(buttonNamed(host, 'Exportar a Excel').disabled).toBe(false);
  });
});

function freshSnapshot(): ExchangeSnapshot {
  return {
    date: '2027-03-01',
    usdToClp: 1_000,
    brlToClp: 200,
    isFallback: false,
    source: 'banco-central',
  };
}

function emptyCatalog(): CatalogResponse {
  return { plans: [], seasons: [], destinations: [] };
}

function catalogWithOptions(): CatalogResponse {
  return {
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
  };
}

function defaultFormConfiguration(): ProgramFormConfiguration {
  return {
    catalogs: emptyCatalog(),
    defaults: {
      generals: { defaultPlanId: 'plan-1' },
      pricing: {
        usdIncreaseCLP: 60,
        brlIncreaseCLP: 40,
        utilityRate: 20,
        rechargeRate: 5,
      },
    },
    policy: { minUtilityRate: 10 },
    scenarioOffsets: [-10, -5, 0, 5],
  };
}

function sampleFavorite(): Favorite {
  return {
    id: 'favorite-1',
    name: 'Mi favorito',
    scope: 'programa',
    content: {
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
      },
      pricing: {
        usdIncreaseCLP: 50,
        brlIncreaseCLP: 10,
        utilityRate: 20,
        rechargeRate: 5,
      },
      crews: [
        {
          name: 'Coordinador',
          documentId: '12345678',
          dailyPrice: 45_000,
          currency: 'CLP',
        },
      ],
      services: [
        {
          name: 'Hotel',
          chargeType: 'per_passenger_night',
          unitPrice: 55,
          currency: 'USD',
        },
      ],
    },
    createdAt: '2026-09-14T12:00:00Z',
    updatedAt: '2026-09-14T12:00:00Z',
  };
}

function completeValidForm(store: ProgramFormStore, name = 'Brasil 2027'): void {
  store.form.controls.generals.setValue({
    name,
    description: 'Gira pedagógica',
    plan: { id: 'plan-1', display: 'Gira de estudio', order: 1 },
    season: { id: '2027', display: '2027', order: 1 },
    destination: {
      id: 'brx',
      display: 'Brasil',
      order: 1,
      budgetTemplateId: 'brochure-default',
    },
    departureCity: 'Santiago',
  });
  store.form.controls.schedule.setValue({
    totalDays: 7,
    totalNights: 6,
    totalPassengers: 30,
    freePassengers: 2,
  });
  store.form.controls.pricing.setValue({
    usdIncreaseCLP: 50,
    brlIncreaseCLP: 10,
    utilityRate: 20,
    rechargeRate: 5,
  });
  const crew = store.form.controls.crews.at(0);
  crew.setValue({
    id: crew.controls.id.value,
    name: 'Coordinador',
    documentId: '12345678',
    dailyPrice: 45_000,
    currency: 'CLP',
  });
  const service = store.form.controls.services.at(0);
  service.setValue({
    id: service.controls.id.value,
    name: 'Hotel',
    chargeType: 'per_passenger_night',
    unitPrice: 55,
    currency: 'USD',
  });
}

const requiredFieldInvalidators: ReadonlyArray<(store: ProgramFormStore) => void> = [
  (store) => store.form.controls.generals.controls.name.setValue(''),
  (store) => store.form.controls.generals.controls.plan.setValue(null),
  (store) => store.form.controls.generals.controls.season.setValue(null),
  (store) => store.form.controls.generals.controls.destination.setValue(null),
  (store) => store.form.controls.generals.controls.departureCity.setValue(''),
  (store) => store.form.controls.schedule.controls.totalDays.setValue(null),
  (store) => store.form.controls.schedule.controls.totalNights.setValue(null),
  (store) => store.form.controls.schedule.controls.totalPassengers.setValue(null),
  (store) => store.form.controls.schedule.controls.freePassengers.setValue(null),
  (store) => store.form.controls.pricing.controls.usdIncreaseCLP.setValue(null),
  (store) => store.form.controls.pricing.controls.brlIncreaseCLP.setValue(null),
  (store) => store.form.controls.pricing.controls.utilityRate.setValue(null),
  (store) => store.form.controls.pricing.controls.rechargeRate.setValue(null),
  (store) => store.form.controls.crews.at(0).controls.name.setValue(''),
  (store) => store.form.controls.crews.at(0).controls.documentId.setValue(''),
  (store) => store.form.controls.crews.at(0).controls.dailyPrice.setValue(null),
  (store) => store.form.controls.crews.at(0).controls.currency.setValue(null),
  (store) => store.form.controls.services.at(0).controls.name.setValue(''),
  (store) => store.form.controls.services.at(0).controls.chargeType.setValue(null),
  (store) => store.form.controls.services.at(0).controls.unitPrice.setValue(null),
  (store) => store.form.controls.services.at(0).controls.currency.setValue(null),
];

function validProgramName(): fc.Arbitrary<string> {
  return fc.string({ minLength: 3, maxLength: 40 }).filter((name) => name.trim().length >= 3);
}

function buttonNamed(host: HTMLElement, text: string): HTMLButtonElement {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === text,
  )!;
}

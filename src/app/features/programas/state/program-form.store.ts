import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';

import {
  buildEffectiveRates,
  calculateProgram,
  derivePayingPassengers,
  deriveTotalDays,
  type CalculationResult,
} from '../calculation/calculation-engine';
import type {
  CalculationInput,
  CrewInput,
  PricingInput,
  ScheduleInput,
  ServiceInput,
} from '../calculation/calculation.types';
import { buildProgramForm, createCrewRow, createServiceRow } from '../forms/program-form.builder';
import { preloadedNights, type NightsSource } from '../forms/nights-preload';
import type { ProgramFormValue } from '../forms/program-form.types';
import type { CatalogOption, DestinationOption } from '../interfaces/catalog.interface';
import type { FavoriteContent } from '../interfaces/favorite.interface';
import type {
  CrewMember,
  Program,
  ProgramService,
  ProgramTotals,
  SummaryRow,
} from '../interfaces/program.interface';
import { CatalogStore } from './catalog.store';
import { ExchangeRateStore } from './exchange-rate.store';

/** Puente feature-scoped entre el formulario tipado y el motor puro de cálculo. */
@Injectable()
export class ProgramFormStore {
  private readonly rates = inject(ExchangeRateStore);
  private readonly catalogs = inject(CatalogStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = buildProgramForm();

  private readonly generalsState = signal(this.form.controls.generals.getRawValue());
  private readonly scheduleState = signal(this.form.controls.schedule.getRawValue());
  private readonly pricingState = signal(this.form.controls.pricing.getRawValue());
  private readonly crewsState = signal(this.form.controls.crews.getRawValue());
  private readonly servicesState = signal(this.form.controls.services.getRawValue());
  private readonly nightsSourceState = signal<NightsSource>('preloaded');

  private applyingPreload = false;

  readonly nightsSource = this.nightsSourceState.asReadonly();
  readonly totalDays = computed(() => {
    const schedule = this.scheduleState();
    return deriveTotalDays(schedule.startDate, schedule.endDate);
  });
  readonly payingPassengers = computed(() => {
    const schedule = this.scheduleState();
    if (schedule.totalPassengers === null || schedule.freePassengers === null) return null;
    return derivePayingPassengers(schedule.totalPassengers, schedule.freePassengers);
  });

  readonly effectiveRates = computed(() => {
    const pricing = pricingInput(this.pricingState(), this.form.controls.pricing.valid);
    const snapshot = this.rates.snapshot();
    return pricing === null || snapshot === null ? null : buildEffectiveRates(pricing, snapshot);
  });

  /** Entrada válida y completa del motor, reutilizable para calcular escenarios. */
  readonly calculationInput = computed<CalculationInput | null>(() => {
    const schedule = scheduleInput(
      this.scheduleState(),
      this.totalDays(),
      this.form.controls.schedule.valid,
    );
    const pricing = pricingInput(this.pricingState(), this.form.controls.pricing.valid);
    const rates = this.effectiveRates();
    if (schedule === null || pricing === null || rates === null) return null;

    return {
      schedule,
      pricing,
      rates,
      crews: crewInputs(this.crewsState(), this.form),
      services: serviceInputs(this.servicesState(), this.form),
    };
  });

  readonly derived = computed<CalculationResult | null>(() => {
    const input = this.calculationInput();
    return input === null ? null : calculateProgram(input);
  });

  readonly rows = computed<SummaryRow[]>(() => this.derived()?.rows ?? []);
  readonly totals = computed<ProgramTotals | null>(() => this.derived()?.totals ?? null);
  readonly program = computed<Program | null>(() => this.buildProgram());
  readonly canPreview = computed(() => this.program() !== null);

  /** El filtro no participa de `totals`; solo transforma las filas visibles. */
  readonly searchTerm = signal('');
  readonly visibleRows = computed(() => filterRows(this.rows(), this.searchTerm()));

  readonly belowUtilityFloor = computed(() => {
    const floor = this.catalogs.settings()?.margin?.minUtilityRate;
    const selected = this.pricingState().utilityRate;
    return floor !== undefined && selected !== null && selected < floor;
  });

  readonly nightsExceedDays = computed(() => {
    const nights = this.scheduleState().totalNights;
    const days = this.totalDays();
    return nights !== null && days > 0 && nights > days;
  });

  constructor() {
    this.subscribeToSections();
    this.subscribeToNightsPreload();

    // El catálogo es un origen asíncrono y FormGroup una API imperativa: este
    // effect es el borde que sincroniza ambos una sola vez por respuesta.
    effect(() => {
      if (this.catalogs.catalogs() === null) return;
      this.catalogs.applyDefaults(this.form);
      this.generalsState.set(this.form.controls.generals.getRawValue());
      this.pricingState.set(this.form.controls.pricing.getRawValue());
    });
  }

  /** Reinicia una edición y reactiva la precarga automática de noches. */
  resetForm(): void {
    this.applyingPreload = true;
    this.form.reset();
    this.nightsSourceState.set('preloaded');
    this.applyingPreload = false;
    this.refreshAllSections();
  }

  /**
   * Carga las noches decididas en un favorito. Cambios posteriores de fechas
   * no pueden reemplazar silenciosamente ese valor.
   */
  setNightsFromFavorite(totalNights: number): void {
    this.applyingPreload = true;
    this.nightsSourceState.set('user');
    this.form.controls.schedule.controls.totalNights.setValue(totalNights);
    this.applyingPreload = false;
  }

  /**
   * Reemplaza el formulario con un favorito y conserva las noches como decisión
   * del usuario. Los derivados se reconstruyen con el snapshot de tasas vigente.
   */
  loadFavorite(content: FavoriteContent): void {
    const controls = this.form.controls;
    this.applyingPreload = true;

    try {
      controls.generals.setValue(
        {
          name: content.generals.name,
          description: content.generals.description ?? '',
          plan: catalogOption(this.catalogs.plans(), content.generals.plan.id),
          season: catalogOption(this.catalogs.seasons(), content.generals.season.id),
          destination: catalogOption(this.catalogs.destinations(), content.generals.destination.id),
          departureCity: content.generals.departureCity,
        },
        { emitEvent: false },
      );
      controls.schedule.setValue(content.schedule, { emitEvent: false });
      controls.pricing.setValue(content.pricing, { emitEvent: false });

      controls.crews.clear({ emitEvent: false });
      for (const crew of content.crews) {
        controls.crews.push(createCrewRow(crew), { emitEvent: false });
      }
      if (controls.crews.length === 0) {
        controls.crews.push(createCrewRow(), { emitEvent: false });
      }

      controls.services.clear({ emitEvent: false });
      for (const service of content.services) {
        controls.services.push(createServiceRow(service), { emitEvent: false });
      }
      if (controls.services.length === 0) {
        controls.services.push(createServiceRow(), { emitEvent: false });
      }

      this.nightsSourceState.set('user');
      this.form.markAsPristine();
    } finally {
      this.applyingPreload = false;
    }

    this.refreshAllSections();
  }

  private subscribeToSections(): void {
    const sections = this.form.controls;
    sections.generals.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.generalsState.set(sections.generals.getRawValue()));
    sections.schedule.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scheduleState.set(sections.schedule.getRawValue()));
    sections.pricing.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pricingState.set(sections.pricing.getRawValue()));
    sections.crews.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.crewsState.set(sections.crews.getRawValue()));
    sections.services.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.servicesState.set(sections.services.getRawValue()));
  }

  private subscribeToNightsPreload(): void {
    const schedule = this.form.controls.schedule.controls;

    schedule.totalNights.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.applyingPreload) this.nightsSourceState.set('user');
    });

    merge(schedule.startDate.valueChanges, schedule.endDate.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyNightsPreload());
  }

  private applyNightsPreload(): void {
    if (this.nightsSourceState() !== 'preloaded') return;

    this.applyingPreload = true;
    this.form.controls.schedule.controls.totalNights.setValue(
      preloadedNights(
        deriveTotalDays(
          this.form.controls.schedule.controls.startDate.value,
          this.form.controls.schedule.controls.endDate.value,
        ),
      ),
    );
    this.applyingPreload = false;
  }

  private refreshAllSections(): void {
    this.generalsState.set(this.form.controls.generals.getRawValue());
    this.scheduleState.set(this.form.controls.schedule.getRawValue());
    this.pricingState.set(this.form.controls.pricing.getRawValue());
    this.crewsState.set(this.form.controls.crews.getRawValue());
    this.servicesState.set(this.form.controls.services.getRawValue());
  }

  /** Proyecta el formulario válido y los derivados a su contrato de salida. */
  private buildProgram(): Program | null {
    const generals = this.generalsState();
    const schedule = this.scheduleState();
    const pricing = this.pricingState();
    const crews = this.crewsState();
    const services = this.servicesState();
    const snapshot = this.rates.snapshot();
    const derived = this.derived();
    const payingPassengers = this.payingPassengers();

    if (
      !this.form.valid ||
      generals.plan === null ||
      generals.season === null ||
      generals.destination === null ||
      schedule.startDate === null ||
      schedule.endDate === null ||
      schedule.totalNights === null ||
      schedule.totalPassengers === null ||
      schedule.freePassengers === null ||
      pricing.usdIncreaseCLP === null ||
      pricing.brlIncreaseCLP === null ||
      pricing.utilityRate === null ||
      pricing.rechargeRate === null ||
      snapshot === null ||
      derived === null ||
      payingPassengers === null ||
      derived.rows.length !== crews.length + services.length
    ) {
      return null;
    }

    const crewRows = derived.rows.slice(0, crews.length);
    const serviceRows = derived.rows.slice(crews.length);

    return {
      generals: {
        name: generals.name.trim(),
        description: generals.description.trim() || null,
        plan: catalogRef(generals.plan),
        season: catalogRef(generals.season),
        destination: catalogRef(generals.destination),
        departureCity: generals.departureCity.trim(),
      },
      schedule: {
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        totalDays: this.totalDays(),
        totalNights: schedule.totalNights,
        totalPassengers: schedule.totalPassengers,
        freePassengers: schedule.freePassengers,
        payingPassengers,
      },
      pricing: {
        usdIncreaseCLP: pricing.usdIncreaseCLP,
        brlIncreaseCLP: pricing.brlIncreaseCLP,
        utilityRate: pricing.utilityRate,
        rechargeRate: pricing.rechargeRate,
        exchange: snapshot,
      },
      crews: crews.map((crew, index): CrewMember => {
        const row = crewRows[index];
        return {
          name: crew.name.trim(),
          documentId: crew.documentId.trim(),
          dailyPrice: crew.dailyPrice!,
          currency: crew.currency!,
          baseAmount: row.baseAmount,
          amountCLP: row.amountCLP,
        };
      }),
      services: services.map((service, index): ProgramService => {
        const row = serviceRows[index];
        return {
          name: service.name.trim(),
          chargeType: service.chargeType!,
          unitPrice: service.unitPrice!,
          currency: service.currency!,
          baseAmount: row.baseAmount,
          amountCLP: row.amountCLP,
        };
      }),
      totals: derived.totals,
    };
  }
}

function catalogRef(option: { readonly id: string; readonly display: string }) {
  return { id: option.id, display: option.display };
}

function catalogOption<T extends CatalogOption | DestinationOption>(
  options: readonly T[],
  id: string,
): T | null {
  return options.find((option) => option.id === id) ?? null;
}

function scheduleInput(
  value: ProgramFormValue['schedule'],
  totalDays: number,
  valid: boolean,
): ScheduleInput | null {
  if (
    !valid ||
    value.totalNights === null ||
    value.totalPassengers === null ||
    value.freePassengers === null
  ) {
    return null;
  }

  return {
    totalDays,
    totalNights: value.totalNights,
    totalPassengers: value.totalPassengers,
    freePassengers: value.freePassengers,
  };
}

function pricingInput(value: ProgramFormValue['pricing'], valid: boolean): PricingInput | null {
  if (
    !valid ||
    value.usdIncreaseCLP === null ||
    value.brlIncreaseCLP === null ||
    value.utilityRate === null ||
    value.rechargeRate === null
  ) {
    return null;
  }

  return {
    usdIncreaseCLP: value.usdIncreaseCLP,
    brlIncreaseCLP: value.brlIncreaseCLP,
    utilityRate: value.utilityRate,
    rechargeRate: value.rechargeRate,
  };
}

function crewInputs(
  values: ProgramFormValue['crews'],
  form: ProgramFormStore['form'],
): CrewInput[] {
  return values.flatMap((value, index) => {
    if (
      !form.controls.crews.at(index).valid ||
      value.dailyPrice === null ||
      value.currency === null
    ) {
      return [];
    }
    return [
      {
        id: value.id,
        name: value.name,
        documentId: value.documentId,
        dailyPrice: value.dailyPrice,
        currency: value.currency,
      },
    ];
  });
}

function serviceInputs(
  values: ProgramFormValue['services'],
  form: ProgramFormStore['form'],
): ServiceInput[] {
  return values.flatMap((value, index) => {
    if (
      !form.controls.services.at(index).valid ||
      value.chargeType === null ||
      value.unitPrice === null ||
      value.currency === null
    ) {
      return [];
    }
    return [
      {
        id: value.id,
        name: value.name,
        chargeType: value.chargeType,
        unitPrice: value.unitPrice,
        currency: value.currency,
      },
    ];
  });
}

function filterRows(rows: readonly SummaryRow[], searchTerm: string): SummaryRow[] {
  const normalized = searchTerm.trim().toLocaleLowerCase('es-CL');
  if (normalized === '') return [...rows];

  return rows.filter((row) => row.name.toLocaleLowerCase('es-CL').includes(normalized));
}

import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';

import { applyMarginDefaults } from '../fn/fn-margin-preload';
import type { ProgramFormGroup } from '../types/program-form.types';
import type { CatalogResponse } from '../interfaces/catalog.interface';
import type { ProgramFormConfiguration } from '../interfaces/program-form-configuration.interface';
import { CatalogService } from '../services/catalog.service';
import { ProgramFormConfigurationService } from '../services/program-form-configuration.service';

/** Estado feature-scoped de catálogos y parámetros de empresa. */
@Injectable()
export class CatalogStore {
  private readonly service = inject(CatalogService);
  private readonly configurationService = inject(ProgramFormConfigurationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly catalogState = signal<CatalogResponse | null>(null);
  private readonly configurationState = signal<ProgramFormConfiguration | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<unknown | null>(null);

  readonly catalogs = this.catalogState.asReadonly();
  readonly configuration = this.configurationState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasError = computed(() => this.errorState() !== null);
  readonly plans = computed(() => this.catalogState()?.plans ?? []);
  readonly seasons = computed(() => this.catalogState()?.seasons ?? []);
  readonly destinations = computed(() => this.catalogState()?.destinations ?? []);
  readonly scenarioOffsets = computed<readonly number[]>(
    () => this.configurationState()?.scenarioOffsets ?? [],
  );
  readonly minUtilityRate = computed(() => this.configurationState()?.policy.minUtilityRate);

  constructor() {
    this.load();
  }

  /** Reintenta la carga si no hay otra solicitud en curso. */
  retry(): void {
    this.load();
  }

  /**
   * Aplica al formulario las selecciones iniciales que dependen del catálogo.
   * Los controles permanecen pristine y una edición previa del usuario nunca
   * se sobrescribe por una respuesta tardía.
   */
  applyDefaults(form: ProgramFormGroup): void {
    const catalog = this.catalogState();
    const configuration = this.configurationState();
    if (catalog === null || configuration === null) return;

    const planControl = form.controls.generals.controls.plan;
    if (planControl.pristine) {
      const defaultPlan = catalog.plans.find(
        (plan) => plan.id === configuration.defaults.generals.defaultPlanId,
      );
      if (defaultPlan !== undefined) {
        planControl.setValue(defaultPlan, { emitEvent: false });
      }
    }

    applyMarginDefaults(form.controls.pricing, {
      ...configuration.defaults.pricing,
      minUtilityRate: configuration.policy.minUtilityRate,
    });
  }

  private load(): void {
    if (this.loadingState()) return;

    this.loadingState.set(true);
    this.errorState.set(null);

    forkJoin({
      catalog: this.service.getCatalogs(),
      configuration: this.configurationService.get(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: ({ catalog, configuration }) => {
          this.catalogState.set(catalog);
          this.configurationState.set(configuration);
        },
        error: (error: unknown) => this.errorState.set(error),
      });
  }
}

import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { DEFAULT_SCENARIO_OFFSETS } from '../constants/scenario-defaults';
import { applyMarginDefaults } from '../forms/margin-preload';
import type { ProgramFormGroup } from '../forms/program-form.types';
import type { CatalogResponse } from '../interfaces/catalog.interface';
import { CatalogService } from '../services/catalog.service';

/** Estado feature-scoped de catálogos y parámetros de empresa. */
@Injectable()
export class CatalogStore {
  private readonly service = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly catalogState = signal<CatalogResponse | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<unknown | null>(null);

  readonly catalogs = this.catalogState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasError = computed(() => this.errorState() !== null);
  readonly plans = computed(() => this.catalogState()?.plans ?? []);
  readonly seasons = computed(() => this.catalogState()?.seasons ?? []);
  readonly destinations = computed(() => this.catalogState()?.destinations ?? []);
  readonly settings = computed(() => this.catalogState()?.settings ?? null);
  readonly scenarioOffsets = computed<readonly number[]>(
    () => this.catalogState()?.settings.scenarioOffsets ?? DEFAULT_SCENARIO_OFFSETS,
  );

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
    if (catalog === null) return;

    const planControl = form.controls.generals.controls.plan;
    if (planControl.pristine) {
      const defaultPlan = catalog.plans.find((plan) => plan.id === catalog.settings.defaultPlanId);
      if (defaultPlan !== undefined) {
        planControl.setValue(defaultPlan, { emitEvent: false });
      }
    }

    applyMarginDefaults(form.controls.pricing, catalog.settings.margin);
  }

  private load(): void {
    if (this.loadingState()) return;

    this.loadingState.set(true);
    this.errorState.set(null);

    this.service
      .getCatalogs()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (catalog) => this.catalogState.set(catalog),
        error: (error: unknown) => this.errorState.set(error),
      });
  }
}

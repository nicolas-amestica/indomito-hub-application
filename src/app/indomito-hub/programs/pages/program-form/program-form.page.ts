import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Panel } from 'primeng/panel';
import { ProgressSpinner } from 'primeng/progressspinner';
import { finalize } from 'rxjs';

import { MotionPressDirective } from '../../../../shared/ui/motion-press.directive';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ClpAmountPipe } from '../../../../shared/formatting/clp-amount.pipe';
import { calculateScenario, deriveScenarios } from '../../calculation/scenarios';
import { FAVORITES_AVAILABLE } from '../../tokens/favorites-availability.token';
import { CrewPanelComponent } from '../../components/crew-panel/crew-panel.component';
import { FallbackRatesNoticeComponent } from '../../components/fallback-rates-notice/fallback-rates-notice.component';
import { FavoritesPanelComponent } from '../../components/favorites-panel/favorites-panel.component';
import { GeneralDataPanelComponent } from '../../components/general-data-panel/general-data-panel.component';
import { PricingPanelComponent } from '../../components/pricing-panel/pricing-panel.component';
import { PreviewDialogComponent } from '../../components/preview-dialog/preview-dialog.component';
import { SchedulePanelComponent } from '../../components/schedule-panel/schedule-panel.component';
import { ServicesPanelComponent } from '../../components/services-panel/services-panel.component';
import { SummaryTableComponent } from '../../components/summary-table/summary-table.component';
import { ExcelExporter } from '../../exporters/excel-exporter';
import { buildExcelLayout } from '../../exporters/excel-layout';
import { favoriteContentFromProgram } from '../../fn/fn-favorite-content';
import type { Favorite } from '../../interfaces/favorite.interface';
import type { BudgetRequest } from '../../interfaces/program.interface';
import { BudgetPdfService } from '../../services/budget-pdf.service';
import { CatalogStore } from '../../stores/catalog.store';
import { ExchangeRateStore } from '../../stores/exchange-rate.store';
import { FavoritesStore } from '../../stores/favorites.store';
import { ProgramFormStore } from '../../stores/program-form.store';
import { APP_MESSAGES } from '../../../../shared/constants/app-messages';

/**
 * Página del formulario de programa.
 *
 * Es el container de la feature: orquesta, no calcula. En esta tarea aporta
 * solo el layout base — el encabezado con el título y la bajada que exige el
 * Requirement 1.1 y la región donde las tareas
 * siguientes del plan montan los paneles del formulario, la tabla de resumen y
 * el panel de favoritos.
 *
 * El contenedor de notificaciones es responsabilidad del armazón raíz.
 */
@Component({
  selector: 'app-program-form-page',
  imports: [
    MotionPressDirective,
    DatePipe,
    RouterLink,
    ClpAmountPipe,
    ButtonDirective,
    Panel,
    ProgressSpinner,
    GeneralDataPanelComponent,
    SchedulePanelComponent,
    PricingPanelComponent,
    CrewPanelComponent,
    ServicesPanelComponent,
    FallbackRatesNoticeComponent,
    FavoritesPanelComponent,
    SummaryTableComponent,
    PreviewDialogComponent,
  ],
  templateUrl: './program-form.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CatalogStore, ExchangeRateStore, FavoritesStore, ProgramFormStore],
})
export class ProgramFormPage {
  protected readonly catalogStore = inject(CatalogStore);
  protected readonly exchangeRateStore = inject(ExchangeRateStore);
  protected readonly programFormStore = inject(ProgramFormStore);
  protected readonly favoritesStore = inject(FavoritesStore);
  protected readonly favoritesAvailable = inject(FAVORITES_AVAILABLE);
  protected readonly previewOpen = signal(false);
  protected readonly previewBusy = signal(false);
  protected readonly favoritesOpen = signal(false);
  protected readonly favoriteSaveOpen = signal(false);
  protected readonly actionBusy = computed(
    () => this.previewBusy() || this.favoritesStore.mutating(),
  );
  protected readonly panelPt = { content: { class: 'p-0!' } } as const;

  private readonly previewTrigger = viewChild<ElementRef<HTMLButtonElement>>('previewTrigger');
  private readonly destroyRef = inject(DestroyRef);
  private readonly excelExporter = inject(ExcelExporter);
  private readonly budgetPdf = inject(BudgetPdfService);
  private readonly notifications = inject(NotificationService);

  protected openPreview(): void {
    if (!this.programFormStore.canPreview()) {
      this.programFormStore.form.markAllAsTouched();
      return;
    }

    this.previewOpen.set(true);
  }

  protected setPreviewVisible(visible: boolean): void {
    this.previewOpen.set(visible);
    if (!visible) {
      queueMicrotask(() => this.previewTrigger()?.nativeElement.focus());
    }
  }

  protected toggleFavorites(): void {
    if (!this.favoritesAvailable) return;

    const visible = !this.favoritesOpen();
    this.favoritesOpen.set(visible);
    if (visible) this.favoritesStore.load('cotizacion');
  }

  protected requestFavoriteSave(): void {
    if (!this.favoritesAvailable) {
      this.notifications.warn(APP_MESSAGES.programs.favoritesUnavailable);
      return;
    }
    if (!this.programFormStore.canPreview()) {
      this.programFormStore.form.markAllAsTouched();
      return;
    }

    this.favoriteSaveOpen.set(true);
  }

  protected saveFavorite(name: string): void {
    const program = this.programFormStore.program();
    if (program === null || this.favoritesStore.mutating()) return;

    this.favoritesStore
      .save(name, favoriteContentFromProgram(program))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.favoriteSaveOpen.set(false);
          this.notifications.success(APP_MESSAGES.programs.favoriteSaved);
        },
        error: (error: unknown) => this.notifyUnexpectedFavoriteError(error),
      });
  }

  protected selectFavorite(favorite: Favorite): void {
    this.programFormStore.loadFavorite(favorite.content);
    this.favoritesStore.select(favorite);
    this.favoritesOpen.set(false);
    this.notifications.success(APP_MESSAGES.programs.favoriteLoaded);
  }

  protected deleteFavorite(favorite: Favorite): void {
    if (this.favoritesStore.mutating()) return;

    this.favoritesStore
      .delete(favorite)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.notifications.success(APP_MESSAGES.programs.favoriteDeleted),
        error: (error: unknown) => this.notifyUnexpectedFavoriteError(error),
      });
  }

  /** Exporta todas las filas calculadas, independientemente del filtro visible en el resumen. */
  protected async exportExcel(): Promise<void> {
    if (this.previewBusy()) return;

    const program = this.programFormStore.program();
    if (!program) return;

    this.previewBusy.set(true);
    try {
      const layout = buildExcelLayout(program, this.programFormStore.rows(), new Date());
      await this.excelExporter.export(layout);
    } catch {
      this.notifications.error(APP_MESSAGES.programs.excelExportError);
    } finally {
      this.previewBusy.set(false);
    }
  }

  /** Calcula los escenarios vigentes y descarga el presupuesto generado por el backend. */
  protected exportPdf(): void {
    if (this.previewBusy()) return;

    const destination = this.programFormStore.form.controls.generals.controls.destination.value;
    if (destination === null) {
      this.notifications.warn(APP_MESSAGES.programs.destinationRequired);
      return;
    }

    const program = this.programFormStore.program();
    const calculationInput = this.programFormStore.calculationInput();
    if (program === null || calculationInput === null) {
      this.programFormStore.form.markAllAsTouched();
      return;
    }

    const request: BudgetRequest = {
      programName: program.generals.name,
      destination,
      departureCity: program.generals.departureCity,
      totalDays: program.schedule.totalDays,
      totalNights: program.schedule.totalNights,
      serviceNames: program.services.map((service) => service.name),
      scenarios: deriveScenarios(
        calculationInput.schedule,
        this.catalogStore.scenarioOffsets(),
      ).map((scenario) => ({
        ...scenario,
        pricePerPassengerCLP: calculateScenario(calculationInput, scenario).totals
          .totalPerPassengerCLP,
      })),
    };

    this.previewBusy.set(true);
    this.budgetPdf
      .generate(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.previewBusy.set(false)),
      )
      .subscribe({
        next: (blob) => this.budgetPdf.download(blob, program.generals.name),
        error: (error: unknown) => {
          // Los errores HTTP ya son traducidos por el interceptor global.
          if (!(error instanceof HttpErrorResponse)) {
            this.notifications.error(APP_MESSAGES.programs.pdfExportError);
          }
        },
      });
  }

  private notifyUnexpectedFavoriteError(error: unknown): void {
    // Los errores HTTP ya son traducidos por el interceptor global.
    if (!(error instanceof HttpErrorResponse)) {
      this.notifications.error(APP_MESSAGES.programs.favoriteOperationError);
    }
  }
}

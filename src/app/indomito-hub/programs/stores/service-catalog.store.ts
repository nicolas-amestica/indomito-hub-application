import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { ServiceCatalogItem } from '../../../shared/service-catalog/interfaces/service-catalog.interface';
import { ServiceCatalogApiService } from '../../../shared/service-catalog/services/service-catalog-api.service';

@Injectable()
export class ServiceCatalogStore {
  private readonly api = inject(ServiceCatalogApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly itemsState = signal<ServiceCatalogItem[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<unknown | null>(null);
  private readonly loadedState = signal(false);

  readonly items = this.itemsState.asReadonly();
  readonly defaults = computed(() => this.itemsState().filter((item) => item.default));
  readonly loading = this.loadingState.asReadonly();
  readonly hasError = computed(() => this.errorState() !== null);
  readonly loaded = this.loadedState.asReadonly();

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  private load(): void {
    if (this.loadingState()) return;
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api
      .list()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (items) => {
          this.itemsState.set(items);
          this.loadedState.set(true);
        },
        error: (error: unknown) => this.errorState.set(error),
      });
  }
}

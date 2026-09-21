import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import type { ExchangeSnapshot } from '../interfaces/program.interface';
import { ExchangeRateService } from '../services/exchange-rate.service';

/** Estado feature-scoped de los tipos de cambio usados por el formulario. */
@Injectable()
export class ExchangeRateStore {
  private readonly service = inject(ExchangeRateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly snapshotState = signal<ExchangeSnapshot | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<unknown | null>(null);

  readonly snapshot = this.snapshotState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasError = computed(() => this.errorState() !== null);
  readonly usingFallback = computed(() => this.snapshotState()?.isFallback === true);
  readonly fallbackDate = computed(() =>
    this.usingFallback() ? (this.snapshotState()?.date ?? null) : null,
  );

  constructor() {
    this.load();
  }

  /** Reintenta la carga si no hay otra solicitud en curso. */
  retry(): void {
    this.load();
  }

  private load(): void {
    if (this.loadingState()) return;

    this.loadingState.set(true);
    this.errorState.set(null);

    this.service
      .getSnapshot()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (snapshot) => this.snapshotState.set(snapshot),
        error: (error: unknown) => this.errorState.set(error),
      });
  }
}

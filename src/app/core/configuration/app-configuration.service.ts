import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiEnvelope } from '../auth/auth.models';

export interface TaxSettings {
  vatRate: number;
  crewWithholdingRate: number;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = { vatRate: 19, crewWithholdingRate: 15.25 };

@Injectable({ providedIn: 'root' })
export class AppConfigurationService {
  private readonly http = inject(HttpClient);
  private readonly taxState = signal<TaxSettings>(DEFAULT_TAX_SETTINGS);
  readonly taxes = this.taxState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<unknown | null>(null);

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<ApiEnvelope<TaxSettings>>(`${environment.apiUrl}/configuracion/tributaria`),
      );
      this.taxState.set(response.data);
    } catch (error) {
      this.error.set(error);
    } finally {
      this.loading.set(false);
    }
  }

  async save(settings: TaxSettings): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<ApiEnvelope<TaxSettings>>(
        `${environment.apiUrl}/configuracion/tributaria`,
        settings,
      ),
    );
    this.taxState.set(response.data);
  }
}

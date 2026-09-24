import { InjectionToken } from '@angular/core';

import { environment } from '../../../../environments/environment';

/** Disponibilidad del backend protegido de favoritos en el ambiente actual. */
export const FAVORITES_AVAILABLE = new InjectionToken<boolean>('FAVORITES_AVAILABLE', {
  providedIn: 'root',
  factory: () => environment.favoritesEnabled,
});

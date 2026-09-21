import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { IndomitoPreset } from './core/theme/indomito.preset';

import { routes } from './app.routes';
import { correlationIdInterceptor } from './core/http/correlation-id.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

registerLocaleData(localeEsCl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([correlationIdInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: IndomitoPreset,
        options: { darkModeSelector: false },
      },
    }),
    { provide: LOCALE_ID, useValue: 'es-CL' },
    // MessageService de PrimeNG no es `providedIn: 'root'`: sin este provider
    // explícito, NotificationService (core/notifications/) no puede
    // inyectarlo, y ningún toast de la aplicación se muestra.
    MessageService,
  ],
};

import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { registerLicense } from '@primeui/license-manager';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { correlationIdInterceptor } from './core/http/correlation-id.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { IndomitoPreset } from './core/theme/indomito.preset';

registerLocaleData(localeEsCl);

registerLicense({
  primeui:
    'eyJpZCI6IjdlNGMyMjVmLTM1ZjYtNGM3ZC05OWU4LTJhMDM4NmFhNTQ2NyIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3OTAxNzMwNzksImV4cCI6MTgyMTcwOTA3OX0.VxWUpNiI0EGA62W5969K6U96DaMMPQM5_W1ndAPcMPL5jNWwxLaJopWdd6BofVAk9gmTxu6T-ffnkqu-TuJlDg',
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),

    provideHttpClient(withInterceptors([correlationIdInterceptor, errorInterceptor])),

    provideAnimationsAsync(),

    providePrimeNG({
      theme: {
        preset: IndomitoPreset,
        options: {
          darkModeSelector: false,
        },
      },
    }),

    {
      provide: LOCALE_ID,
      useValue: 'es-CL',
    },

    MessageService,
  ],
};

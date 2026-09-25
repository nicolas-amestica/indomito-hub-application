import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { registerLicense } from '@primeui/license-manager';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { DialogService } from 'primeng/dynamicdialog';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { correlationIdInterceptor } from './core/http/correlation-id.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { PRIMENG_ES_CL } from './core/i18n/primeng-es-cl';
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

    provideHttpClient(
      withInterceptors([authInterceptor, correlationIdInterceptor, errorInterceptor]),
    ),

    provideAnimationsAsync(),

    providePrimeNG({
      translation: PRIMENG_ES_CL,
      theme: {
        preset: IndomitoPreset,
        options: {
          darkModeSelector: false,
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
    }),

    {
      provide: LOCALE_ID,
      useValue: 'es-CL',
    },

    MessageService,
    DialogService,
  ],
};

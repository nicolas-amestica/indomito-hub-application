import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import type { ProgramFormConfiguration } from '../interfaces/program-form-configuration.interface';
import { ProgramFormConfigurationService } from './program-form-configuration.service';

describe('ProgramFormConfigurationService', () => {
  it('obtiene la configuración PGR y desenvuelve la respuesta', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(ProgramFormConfigurationService);
    const http = TestBed.inject(HttpTestingController);
    const configuration: ProgramFormConfiguration = {
      defaults: {
        generals: { defaultPlanId: 'study' },
        pricing: {
          usdIncreaseCLP: 60,
          brlIncreaseCLP: 40,
          utilityRate: 20,
          rechargeRate: 5,
        },
      },
      policy: { minUtilityRate: 10 },
      scenarioOffsets: [-10, -5, 0, 5],
    };
    let received: ProgramFormConfiguration | undefined;

    service.get().subscribe((value) => (received = value));

    const request = http.expectOne(`${environment.apiUrl}/contratos:configuracion?scope=PGR`);
    expect(request.request.method).toBe('GET');
    request.flush({ data: configuration });
    expect(received).toEqual(configuration);
    http.verify();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import type { BudgetRequest } from '../interfaces/program.interface';
import { BudgetPdfService, buildBudgetPdfFileName } from './budget-pdf.service';

const REQUEST: BudgetRequest = {
  programName: 'Brasil 2027',
  destination: {
    id: 'BRX',
    display: 'Brasil',
    order: 1,
    budgetTemplateId: 'brochure-default',
  },
  departureCity: 'Santiago',
  totalDays: 7,
  totalNights: 6,
  serviceNames: ['Hotel'],
  scenarios: [
    {
      totalPassengers: 30,
      freePassengers: 2,
      payingPassengers: 28,
      pricePerPassengerCLP: 482_000,
    },
  ],
};

describe('BudgetPdfService', () => {
  let service: BudgetPdfService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BudgetPdfService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('envía el contrato completo y recibe el PDF como blob', () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    let received: Blob | undefined;

    service.generate(REQUEST).subscribe((value) => (received = value));
    const request = http.expectOne(`${environment.apiUrl}/programas:presupuesto`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(REQUEST);
    expect(request.request.responseType).toBe('blob');
    request.flush(pdf);
    expect(received).toBe(pdf);
  });

  it('descarga el documento sin navegar y libera la URL temporal', () => {
    const createObjectURL = vi.fn(() => 'blob:budget-pdf');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });

    service.download(pdf, 'Brasil 2027');

    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(createObjectURL).toHaveBeenCalledWith(pdf);
    expect(anchor.href).toBe('blob:budget-pdf');
    expect(anchor.download).toBe('presupuesto_brasil_2027.pdf');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:budget-pdf');
  });

  it('deriva un nombre seguro incluso si el programa contiene caracteres reservados', () => {
    expect(buildBudgetPdfFileName('  Gira: Brasil / 2027  ')).toBe(
      'presupuesto_gira_brasil_2027.pdf',
    );
  });
});

import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { convertToParamMap, provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DocumentPreviewService } from '../../../../shared/documents/services/document-preview.service';
import type { Contract, ContractAmendment } from '../../interfaces/contract.interface';
import { ContractsService } from '../../services/contracts.service';
import { ContractAmendmentsPage } from './contract-amendments.page';

const contract = {
  id: 'contract',
  version: 4,
  status: 'APPROVED',
  content: {
    trip: { departureDate: '', returnDate: '', days: 4, nights: 3 },
    plan: { servicesIncluded: [{ description: 'Transporte original' }] },
  },
} as Contract;

const approved = {
  id: 'approved',
  contractId: 'contract',
  baseContractVersion: 4,
  baseTermsRevision: 0,
  version: 2,
  status: 'APPROVED',
  reason: 'Definir fechas',
  before: {
    departureDate: '',
    returnDate: '',
    days: 4,
    nights: 3,
    services: [{ description: 'Transporte original' }],
  },
  after: {
    departureDate: '2027-10-05T00:00:00Z',
    returnDate: '2027-10-08T00:00:00Z',
    days: 4,
    nights: 3,
    services: [{ description: 'Transporte vigente' }],
  },
  createdAt: '2026-10-05T00:00:00Z',
  createdBy: 'operator',
} as ContractAmendment;

describe('ContractAmendmentsPage', () => {
  it('starts a new draft from the latest approved terms, not the original contract', async () => {
    const api = {
      get: vi.fn().mockReturnValue(of(contract)),
      listAmendments: vi.fn().mockReturnValue(of({ items: [approved] })),
      createAmendment: vi
        .fn()
        .mockImplementation((_id, request) =>
          of({
            ...request,
            contractId: 'contract',
            baseTermsRevision: 1,
            version: 1,
            status: 'DRAFT',
            before: approved.after,
            createdAt: '',
            createdBy: '',
          }),
        ),
    };
    await TestBed.configureTestingModule({
      imports: [ContractAmendmentsPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ContractsService, useValue: api },
        { provide: DocumentPreviewService, useValue: { open: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'contract' })) },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContractAmendmentsPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      form: {
        patchValue(value: object): void;
        controls: { services: { at(index: number): { value: string } } };
      };
      createDraft(): Promise<void>;
    };
    expect(component.form.controls.services.at(0).value).toBe('Transporte vigente');
    component.form.patchValue({ reason: 'Agregar hotel actualizado' });
    await component.createDraft();
    const request = api.createAmendment.mock.calls[0][1];
    expect(request.baseContractVersion).toBe(4);
    expect(request.after.departureDate).toBe('2027-10-05');
    expect(request.after.services).toEqual([{ description: 'Transporte vigente' }]);
    expect(JSON.stringify(request)).not.toContain('payments');
  });
});

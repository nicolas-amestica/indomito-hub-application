import { TestBed } from '@angular/core/testing';
import { ReceiptApi } from '../../../../shared/payment-receipts/services/receipt-api';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountOperationsPage } from './account-operations.page';
import { CollectionAccounts } from '../../services/collection-accounts';
import { CollectionTreasury } from '../../services/collection-treasury';
import type { CollectionAccount } from '../../interfaces/collection-account.interface';

describe('AccountOperationsPage', () => {
  const api = { get: vi.fn(), apply: vi.fn(), attempts: vi.fn() };
  const treasury = { recoverOperation: vi.fn() };
  const account: CollectionAccount = {
    id: 'account',
    tripId: 'trip',
    participantId: 'person',
    version: 1,
    active: true,
    free: false,
    depositAgreed: 10000,
    depositReceived: 0,
    unappliedReceived: 0,
    withdrawalRefundApproved: 0,
    unappliedRefundApproved: 0,
    refunded: 0,
    installments: [
      { id: '0001', dueDate: '2027-01-05', original: 20000, discount: 0, cancelled: 0, paid: 0 },
    ],
  };
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockReturnValue(of(account));
    TestBed.configureTestingModule({
      imports: [AccountOperationsPage],
      providers: [
        { provide: ReceiptApi, useValue: {} },
        provideRouter([]),
        { provide: CollectionAccounts, useValue: api },
        { provide: CollectionTreasury, useValue: treasury },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'account' })),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    });
  });
  function input(root: HTMLElement, id: string, value: string) {
    const field = root.querySelector(id) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }
  function submit(root: HTMLElement) {
    root
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  it('exige revisión explícita antes de registrar dinero', async () => {
    const fixture = TestBed.createComponent(AccountOperationsPage);
    await fixture.whenStable();
    submit(fixture.nativeElement);
    await fixture.whenStable();
    expect(api.apply).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Revisa los campos requeridos');
  });
  it('conserva clave y contenido tras respuesta perdida y evita doble envío', async () => {
    const fixture = TestBed.createComponent(AccountOperationsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    input(root, '#reason', 'Transferencia verificada en cartola');
    input(root, '#reference', 'account-001:movement-001');
    fixture.componentInstance['form'].controls.effectiveDate.setValue('2026-09-30');
    input(root, '#receipt-email', 'payer@example.com');
    (root.querySelector('#reviewed') as HTMLInputElement).click();
    await fixture.whenStable();
    const response = new Subject<CollectionAccount>();
    api.apply.mockReturnValue(response);
    submit(root);
    submit(root);
    expect(api.apply).toHaveBeenCalledTimes(1);
    const first = api.apply.mock.calls[0];
    expect(first[1]).toMatchObject({
      version: 1,
      operation: 'MANUAL_INSTALLMENT',
      reference: 'account-001:movement-001',
      email: 'payer@example.com',
    });
    expect(first[1].amount).toBeUndefined();
    response.error(new Error('private-error'));
    await fixture.whenStable();
    expect(root.textContent).not.toContain('private-error');
    api.apply.mockReturnValue(
      of({ ...account, version: 2, installments: [{ ...account.installments[0], paid: 20000 }] }),
    );
    submit(root);
    await fixture.whenStable();
    expect(api.apply.mock.calls[1]).toEqual(first);
    expect(root.textContent).toContain('Operación registrada');
    expect(root.textContent).toContain('versión 2');
  });
  it('envía asignación de fondos en revisión sin monto ni referencia bancaria', async () => {
    api.get.mockReturnValue(
      of({ ...account, unappliedReceived: 20000, reviewAttemptId: 'attempt' }),
    );
    api.apply.mockReturnValue(
      of({
        ...account,
        version: 2,
        unappliedReceived: 0,
        installments: [{ ...account.installments[0], paid: 20000 }],
      }),
    );
    const fixture = TestBed.createComponent(AccountOperationsPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      form: { setValue(v: unknown): void };
    };
    component.form.setValue({
      operation: 'ALLOCATE_UNAPPLIED',
      reason: 'Fondos y cuota completa revisados',
      amount: 0,
      percentage: 0,
      installmentIds: ['0001'],
      reference: '',
      effectiveDate: '',
      email: '',
      reviewed: true,
    });
    fixture.detectChanges();
    submit(fixture.nativeElement);
    await fixture.whenStable();
    expect(api.apply).toHaveBeenCalledTimes(1);
    expect(api.apply.mock.calls[0][1]).toMatchObject({
      operation: 'ALLOCATE_UNAPPLIED',
      installmentIds: ['0001'],
    });
    expect(api.apply.mock.calls[0][1].amount).toBeUndefined();
    expect(api.apply.mock.calls[0][1].reference).toBeUndefined();
  });
});

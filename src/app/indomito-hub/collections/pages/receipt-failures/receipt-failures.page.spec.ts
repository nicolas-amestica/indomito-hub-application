import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionReceiptFailures } from '../../services/collection-receipt-failures';
import { ReceiptFailuresPage } from './receipt-failures.page';

describe('ReceiptFailuresPage', () => {
  const api = { list: vi.fn(), retry: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockReturnValue(
      of({ items: [{ receiptId: 'r1', failureCode: 'SMTP_NOT_ACCEPTED', deliveryAttempts: 5 }] }),
    );
    TestBed.configureTestingModule({
      imports: [ReceiptFailuresPage],
      providers: [provideRouter([]), { provide: CollectionReceiptFailures, useValue: api }],
    });
  });
  it('exige trazabilidad antes de reintentar', async () => {
    const fixture = TestBed.createComponent(ReceiptFailuresPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as { retry(item: unknown): void };
    component.retry({ receiptId: 'r1' });
    expect(api.retry).not.toHaveBeenCalled();
  });
  it('encola sin presentar un nuevo pago', async () => {
    api.retry.mockReturnValue(of({ receiptId: 'r1' }));
    const fixture = TestBed.createComponent(ReceiptFailuresPage);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      retry(item: unknown): void;
      form: { patchValue(value: unknown): void };
    };
    component.form.patchValue({ reason: 'Correo revisado' });
    component.retry({ receiptId: 'r1' });
    fixture.detectChanges();
    expect(api.retry).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('no fueron modificados');
  });
});

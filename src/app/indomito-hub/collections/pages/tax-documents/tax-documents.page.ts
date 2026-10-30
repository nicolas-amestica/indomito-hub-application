import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';
import { newUlid } from '../../../../shared/fn/new-ulid';
import type { TaxDocumentItem, TaxDocumentRequest } from '../../interfaces/tax-document.interface';
import { CollectionTaxDocuments } from '../../services/collection-tax-documents';

@Component({ selector: 'app-tax-documents', imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, ButtonDirective, Checkbox, DateOnlyPickerComponent, InputNumber, InputText, Message, Panel, TableModule], templateUrl: './tax-documents.page.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class TaxDocumentsPage {
  private readonly api = inject(CollectionTaxDocuments);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly items = signal<TaxDocumentRequest[]>([]);
  protected readonly form = new FormGroup({ issueDate: new FormControl(todayDateOnly(), { nonNullable: true, validators: [Validators.required] }), customerRut: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(12)] }), reference: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(90)] }), items: new FormArray([this.newItem()]) });

  constructor() { this.load(); }
  protected newItem(): FormGroup { return new FormGroup({ description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }), quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }), unitPrice: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }), exempt: new FormControl(false, { nonNullable: true }), unit: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4)] }) }); }
  protected addItem(): void { if (this.form.controls.items.length < 20) this.form.controls.items.push(this.newItem()); }
  protected removeItem(index: number): void { if (this.form.controls.items.length > 1) this.form.controls.items.removeAt(index); }
  protected total(): number { return this.form.controls.items.getRawValue().reduce((sum, item) => sum + item['quantity'] * item['unitPrice'], 0); }
  protected load(): void { if (this.busy()) return; this.busy.set(true); this.api.list('PENDING').pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: page => this.items.set(page.items), error: () => this.error.set('No fue posible consultar las boletas.') }); }
  protected create(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.total() <= 0 || this.busy()) { this.error.set('Completa al menos un ítem válido.'); return; }
    const raw = this.form.getRawValue(); this.busy.set(true); this.error.set(''); this.success.set('');
    this.api.create({ commandId: newUlid(), issueDate: raw.issueDate, customerRut: raw.customerRut.trim(), reference: raw.reference.trim(), items: raw.items.map(item => ({ ...item, description: item['description'].trim(), unit: item['unit'].trim() })) as TaxDocumentItem[] }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: item => { this.items.update(items => [item, ...items]); this.success.set('Boleta encolada para emisión ante el SII.'); }, error: () => this.error.set('No fue posible crear la boleta. Revisa los datos antes de reintentar.') });
  }
  protected issue(item: TaxDocumentRequest): void { if (this.busy() || item.status === 'SUBMITTED') return; this.busy.set(true); this.error.set(''); this.api.issue(item.requestId).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: updated => { this.items.update(items => items.map(current => current.requestId === updated.requestId ? updated : current)); this.success.set(`Boleta folio ${updated.siiIssuance?.folio ?? ''} enviada al SII.`); }, error: () => this.error.set('La emisión no pudo completarse. Revisa el estado antes de volver a intentar.') }); }
}

import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { FileUpload, type FileUploadHandlerEvent } from 'primeng/fileupload';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { newUlid } from '../../../../shared/fn/new-ulid';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';
import { fileToBase64 } from '../../fn/file-to-base64';
import type {
  TaxDocumentListStatus,
  TaxDocumentRequest,
} from '../../interfaces/tax-document.interface';
import { CollectionTaxDocuments } from '../../services/collection-tax-documents';

@Component({
  selector: 'app-tax-documents',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    Checkbox,
    DateOnlyPickerComponent,
    FileUpload,
    InputText,
    Message,
    Panel,
    SelectButton,
    TableModule,
    Textarea,
  ],
  templateUrl: './tax-documents.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxDocumentsPage {
  private readonly api = inject(CollectionTaxDocuments);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly status = signal<TaxDocumentListStatus>('PENDING');
  protected readonly items = signal<TaxDocumentRequest[]>([]);
  protected readonly nextCursor = signal('');
  protected readonly selected = signal<TaxDocumentRequest | null>(null);
  protected readonly selectedPDF = signal<File | null>(null);
  protected readonly statusOptions = [
    { label: 'Pendientes', value: 'PENDING' },
    { label: 'Registradas', value: 'RECORDED' },
  ];
  protected readonly form = new FormGroup({
    folio: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{1,18}$/)],
    }),
    issueDate: new FormControl(todayDateOnly(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    reviewed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  constructor() {
    this.load(false);
  }

  protected changeStatus(value: TaxDocumentListStatus): void {
    this.status.set(value);
    this.cancel();
    this.load(false);
  }

  protected load(more: boolean): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .list(this.status(), more ? this.nextCursor() : '')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (page) => {
          this.items.update((current) => (more ? [...current, ...page.items] : page.items));
          this.nextCursor.set(page.nextCursor ?? '');
        },
        error: () => this.error.set('No fue posible consultar las boletas pendientes.'),
      });
  }

  protected begin(item: TaxDocumentRequest): void {
    this.selected.set(item);
    this.selectedPDF.set(null);
    this.form.reset({ folio: '', issueDate: todayDateOnly(), reason: '', reviewed: false });
    this.error.set('');
  }

  protected selectPDF(event: FileUploadHandlerEvent, uploader: FileUpload): void {
    const file = event.files[0];
    if (!file || file.type !== 'application/pdf' || file.size > 5 * 1024 * 1024) {
      this.selectedPDF.set(null);
      this.error.set('Selecciona un PDF de hasta 5 MB.');
      uploader.clear();
      return;
    }
    this.selectedPDF.set(file);
    this.error.set('');
  }

  protected async save(): Promise<void> {
    const selected = this.selected();
    const file = this.selectedPDF();
    this.form.markAllAsTouched();
    if (!selected || !file || this.form.invalid || this.busy()) {
      this.error.set('Completa los datos, confirma la revisión y carga la boleta PDF.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const pdfBase64 = await fileToBase64(file);
      const { folio, issueDate, reason } = this.form.getRawValue();
      this.api
        .recordManual(selected.requestId, {
          commandId: newUlid(),
          folio,
          issueDate,
          reason: reason.trim(),
          pdfBase64,
        })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.busy.set(false)),
        )
        .subscribe({
          next: () => {
            this.items.update((items) =>
              items.filter((item) => item.requestId !== selected.requestId),
            );
            this.success.set(
              `Boleta folio ${folio} registrada. El pago y la cuota no fueron modificados.`,
            );
            this.cancel();
          },
          error: () =>
            this.error.set(
              'No fue posible confirmar el registro. Recarga la lista antes de reintentar.',
            ),
        });
    } catch {
      this.busy.set(false);
      this.error.set('No fue posible leer el PDF seleccionado.');
    }
  }

  protected download(item: TaxDocumentRequest): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .download(item.requestId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
        error: () => this.error.set('No fue posible preparar la descarga privada.'),
      });
  }

  protected cancel(): void {
    this.selected.set(null);
    this.selectedPDF.set(null);
  }
}

import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { FileUpload, type FileSelectEvent } from 'primeng/fileupload';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { finalize } from 'rxjs';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { todayDateOnly } from '../../../../shared/date-only/date-only';
import { newUlid } from '../../../../shared/fn/new-ulid';
import type {
  TaxConfigurationInput,
  TaxConfigurationSummary,
  TaxDocumentItem,
  TaxDocumentRequest,
} from '../../interfaces/tax-document.interface';
import { CollectionTaxDocuments } from '../../services/collection-tax-documents';

@Component({
  selector: 'app-tax-documents',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    Checkbox,
    DateOnlyPickerComponent,
    FileUpload,
    InputNumber,
    InputText,
    Message,
    Panel,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    TableModule,
    Tabs,
    Tag,
  ],
  templateUrl: './tax-documents.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxDocumentsPage {
  private readonly api = inject(CollectionTaxDocuments);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly configurationBusy = signal(false);
  protected readonly uploadingCaf = signal(false);
  protected readonly uploadingPfx = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly items = signal<TaxDocumentRequest[]>([]);
  protected readonly rejectedCount = computed(() => this.items().filter(item => item.status === 'REJECTED' && !item.reissuedBy).length);
  protected readonly configuration = signal<TaxConfigurationSummary | null>(null);
  protected readonly selectedCafName = signal('');
  protected readonly selectedPfxName = signal('');
  protected readonly cafConfigured = computed(() => this.configuration()?.caf.from !== 0);
  protected readonly certificateConfigured = computed(
    () => !!this.configuration()?.certificate.validTo,
  );
  protected readonly form = new FormGroup({
    issueDate: new FormControl(todayDateOnly(), { nonNullable: true, validators: [Validators.required] }),
    customerRut: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(12)] }),
    items: new FormArray([this.newItem()]),
  });
  protected readonly configurationForm = new FormGroup({
    senderRut: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(12)] }),
    issuerName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    issuerActivity: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    issuerAddress: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    issuerCommune: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    resolutionDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    resolutionNumber: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    enabled: new FormControl(false, { nonNullable: true }),
    certificationApproved: new FormControl(false, { nonNullable: true }),
  });
  protected readonly pfxPassword = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  constructor() {
    this.load();
    this.loadConfiguration();
  }

  protected newItem(): FormGroup {
    return new FormGroup({
      description: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
      quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
      unitPrice: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
      exempt: new FormControl(false, { nonNullable: true }),
      unit: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4)] }),
    });
  }

  protected addItem(): void {
    if (this.form.controls.items.length < 20) this.form.controls.items.push(this.newItem());
  }

  protected removeItem(index: number): void {
    if (this.form.controls.items.length > 1) this.form.controls.items.removeAt(index);
  }

  protected total(): number {
    return this.form.controls.items.getRawValue().reduce((sum, item) => sum + item['quantity'] * item['unitPrice'], 0);
  }

  protected load(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.listAll().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: page => this.items.set(page.items),
      error: () => this.error.set('No fue posible consultar las boletas.'),
    });
  }

  protected create(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.total() <= 0 || this.busy()) {
      this.error.set('Completa al menos un ítem válido.');
      return;
    }
    const raw = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    this.api.create({
      commandId: newUlid(),
      issueDate: raw.issueDate,
      customerRut: raw.customerRut.trim(),
      items: raw.items.map(item => ({ ...item, description: item['description'].trim(), unit: item['unit'].trim() })) as TaxDocumentItem[],
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: item => {
        this.items.update(items => [item, ...items]);
        this.success.set('Boleta encolada para emisión ante el SII.');
      },
      error: () => this.error.set('No fue posible crear la boleta. Revisa los datos antes de reintentar.'),
    });
  }

  protected issue(item: TaxDocumentRequest): void {
    if (this.busy() || item.status === 'SUBMITTED') return;
    this.busy.set(true);
    this.error.set('');
    this.api.issue(item.requestId).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: updated => {
        this.items.update(items => items.map(current => current.requestId === updated.requestId ? updated : current));
        this.success.set(`Boleta folio ${updated.siiIssuance?.folio ?? ''} enviada al SII.`);
      },
      error: () => this.error.set('La emisión no pudo completarse. Revisa el estado antes de volver a intentar.'),
    });
  }

  protected download(item: TaxDocumentRequest): void {
    if (this.busy() || !['SUBMITTED', 'ACCEPTED', 'ACCEPTED_WITH_REPAIRS'].includes(item.status)) return;
    this.busy.set(true);
    this.api.download(item.requestId).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
      error: () => this.error.set('La representación PDF todavía no está disponible.'),
    });
  }

  protected reissue(item: TaxDocumentRequest): void {
    if (this.busy() || item.status !== 'REJECTED' || item.reissuedBy) return;
    this.busy.set(true);
    this.error.set('');
    this.api.reissue(item.requestId, newUlid()).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: replacement => {
        this.items.update(items => [replacement, ...items.map(current => current.requestId === item.requestId ? { ...current, reissuedBy: replacement.requestId } : current)]);
        this.success.set('Se creó una nueva emisión con otro folio. El folio rechazado no será reutilizado.');
      },
      error: () => this.error.set('No fue posible regenerar la boleta rechazada.'),
    });
  }

  protected loadConfiguration(): void {
    if (this.configurationBusy()) return;
    this.configurationBusy.set(true);
    this.api.getConfiguration().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.configurationBusy.set(false))).subscribe({
      next: configuration => this.applyConfiguration(configuration),
      error: () => this.error.set('No fue posible cargar la configuración tributaria.'),
    });
  }

  protected saveConfiguration(): void {
    this.configurationForm.markAllAsTouched();
    if (this.configurationForm.invalid || this.configurationBusy()) return;
    this.configurationBusy.set(true);
    this.error.set('');
    const raw = this.configurationForm.getRawValue();
    const request: TaxConfigurationInput = {
      ...raw,
      environment: this.configuration()?.environment ?? 'CERTIFICATION',
    };
    this.api.updateConfiguration(request).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.configurationBusy.set(false))).subscribe({
      next: configuration => {
        this.applyConfiguration(configuration);
        this.success.set('Datos del emisor guardados. La emisión vigente no fue modificada.');
      },
      error: () => this.error.set('No fue posible guardar los datos del emisor.'),
    });
  }

  protected async uploadCaf(event: FileSelectEvent, uploader: FileUpload): Promise<void> {
    const file = Array.from(event.files)[0];
    uploader.clear();
    if (!file || this.uploadingCaf() || !file.name.toLowerCase().endsWith('.xml') || file.size > 512 * 1024) {
      this.error.set('Selecciona un archivo CAF XML válido de hasta 512 KB.');
      return;
    }
    this.uploadingCaf.set(true);
    this.error.set('');
    try {
      const cafXmlBase64 = await this.fileAsBase64(file);
      const configuration = await this.api.uploadCaf(cafXmlBase64).pipe(takeUntilDestroyed(this.destroyRef)).toPromise();
      if (!configuration) throw new Error('Missing tax configuration response');
      this.selectedCafName.set(file.name);
      this.applyConfiguration(configuration);
      this.success.set('CAF validado y guardado de forma segura. La emisión vigente conserva su configuración actual.');
    } catch {
      this.error.set('No fue posible cargar el CAF. Verifica que sea un CAF DTE tipo 39 válido.');
    } finally {
      this.uploadingCaf.set(false);
    }
  }

  protected async uploadPfx(event: FileSelectEvent, uploader: FileUpload): Promise<void> {
    const file = Array.from(event.files)[0];
    uploader.clear();
    this.pfxPassword.markAsTouched();
    if (!file || this.uploadingPfx() || !file.name.toLowerCase().endsWith('.pfx') || file.size > 512 * 1024 || this.pfxPassword.invalid) {
      this.error.set('Selecciona un certificado .pfx válido de hasta 512 KB e ingresa su contraseña.');
      return;
    }
    this.uploadingPfx.set(true);
    this.error.set('');
    try {
      const pfxBase64 = await this.fileAsBase64(file);
      const configuration = await this.api.uploadPfx(pfxBase64, this.pfxPassword.value).pipe(takeUntilDestroyed(this.destroyRef)).toPromise();
      if (!configuration) throw new Error('Missing tax configuration response');
      this.selectedPfxName.set(file.name);
      this.pfxPassword.reset();
      this.applyConfiguration(configuration);
      this.success.set('Certificado validado y guardado de forma segura. La emisión vigente conserva su configuración actual.');
    } catch {
      this.error.set('No fue posible cargar el certificado. Revisa el archivo y su contraseña.');
    } finally {
      this.uploadingPfx.set(false);
    }
  }

  protected cafSeverity(): 'success' | 'warn' | 'danger' | 'secondary' {
    return this.configuration()?.caf.severity === 'OK' ? 'success' : this.configuration()?.caf.severity === 'LOW' ? 'warn' : this.configuration()?.caf.severity === 'EXHAUSTED' ? 'danger' : 'secondary';
  }

  protected certificateSeverity(): 'success' | 'warn' | 'danger' | 'secondary' {
    return this.configuration()?.certificate.severity === 'OK' ? 'success' : this.configuration()?.certificate.severity === 'EXPIRING' ? 'warn' : this.configuration()?.certificate.severity === 'EXPIRED' ? 'danger' : 'secondary';
  }

  private applyConfiguration(configuration: TaxConfigurationSummary): void {
    this.configuration.set(configuration);
    this.configurationForm.patchValue({
      senderRut: configuration.senderRut,
      issuerName: configuration.issuerName,
      issuerActivity: configuration.issuerActivity,
      issuerAddress: configuration.issuerAddress,
      issuerCommune: configuration.issuerCommune,
      resolutionDate: configuration.resolutionDate,
      resolutionNumber: configuration.resolutionNumber,
      enabled: configuration.enabled,
      certificationApproved: configuration.certificationApproved,
    });
  }

  private fileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const value = typeof reader.result === 'string' ? reader.result : '';
        const separator = value.indexOf(',');
        if (separator < 0) reject(new Error('Invalid file payload'));
        else resolve(value.slice(separator + 1));
      };
      reader.readAsDataURL(file);
    });
  }
}

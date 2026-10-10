import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormArray,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  distinctUntilChanged,
  finalize,
  forkJoin,
  from,
  merge,
  skip,
  switchMap,
  throwError,
  type Observable,
} from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { FileUpload } from 'primeng/fileupload';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Table } from 'primeng/table';
import { Checkbox } from 'primeng/checkbox';
import { Textarea } from 'primeng/textarea';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ContractExcelImporter } from '../../importers/contract-excel.importer';
import type { Favorite, FavoriteSummary } from '../../../programs/interfaces/favorite.interface';
import {
  buildEffectiveRates,
  calculateProgram,
} from '../../../programs/calculation/calculation-engine';
import { FavoritesService } from '../../../programs/services/favorites.service';
import { calculateContractPayments } from '../../fn/calculate-contract-payments';
import { birthDateValidator, rutValidator } from '../../fn/contract-validators';
import { optionalTravelRangeValidator } from '../../validators/optional-travel-range.validator';
import { installmentStartValidator } from '../../validators/installment-start.validator';
import { installmentMonthNumber } from '../../fn/installment-calendar';
import { getInvalidContractFields } from '../../fn/get-invalid-contract-fields';
import { reconcileFormArray } from '../../fn/reconcile-form-array';
import { RequiredFieldMessageDirective } from '../../directives/required-field-message.directive';
import { CONTRACT_SEX_OPTIONS } from '../../constants/contract-options';
import type {
  Contract,
  ContractContent,
  ContractFormConfiguration,
  ContractPDFAccess,
  ContractProgramReference,
  ContractStatus,
  ContractSignatureStatus,
  ContractSignedDocument,
} from '../../interfaces/contract.interface';
import { ContractsService } from '../../services/contracts.service';
import { ContractTemplateService } from '../../services/contract-template.service';
import { DocumentPreviewService } from '../../../../shared/documents/services/document-preview.service';
import { APP_MESSAGES } from '../../../../shared/constants/app-messages';
import { sha256File } from '../../fn/sha256-file';

@Component({
  selector: 'app-contract-form-page',
  imports: [
    RouterLink,
    DatePipe,
    ButtonDirective,
    Checkbox,
    DatePicker,
    FileUpload,
    InputNumber,
    InputText,
    FormsModule,
    ReactiveFormsModule,
    RequiredFieldMessageDirective,
    Select,
    Table,
    Textarea,
  ],
  templateUrl: './contract-form.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractFormPage {
  protected readonly auth = inject(AuthService);
  private readonly requiredMessages = viewChildren(RequiredFieldMessageDirective);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ContractsService);
  private readonly favoritesApi = inject(FavoritesService);
  protected readonly template = inject(ContractTemplateService);
  private readonly importer = inject(ContractExcelImporter);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly documentPreview = inject(DocumentPreviewService);
  protected readonly busy = signal(false);
  protected readonly importing = signal(false);
  protected readonly contractId = signal<string | null>(null);
  protected readonly version = signal(0);
  protected readonly status = signal<ContractStatus>('DRAFT');
  protected readonly locked = signal(false);
  protected readonly signatureStatus = signal<ContractSignatureStatus>('NOT_REQUIRED');
  protected readonly signedDocument = signal<ContractSignedDocument | null>(null);
  protected readonly signedDocuments = signal<ContractSignedDocument[]>([]);
  protected readonly signedDocumentsNextCursor = signal('');
  protected readonly confirmsAllSignatures = signal(false);
  protected readonly replacementReason = signal('');
  protected readonly signedUploadBusy = signal(false);
  protected readonly programs = signal<FavoriteSummary[]>([]);
  protected readonly programsLoading = signal(false);
  protected readonly configuration = signal<ContractFormConfiguration | null>(null);
  protected readonly sexOptions = CONTRACT_SEX_OPTIONS;
  protected readonly minInstallmentStartDate = new Date(2000, 0, 1);
  protected readonly maxInstallmentStartDate = new Date(2200, 11, 31);
  protected readonly maxBirthDate = new Date();
  protected readonly defaultBirthDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 17);
    return d;
  })();
  protected readonly datePickerPt = {
    panel: { class: 'border-line/55!' },
  } as const;
  protected readonly selectPt = {
    overlay: { class: 'border-line/55!' },
    listContainer: { class: 'border-line/55!' },
  } as const;
  private readonly programReference = signal<ContractProgramReference | null>(null);

  protected readonly form = this.fb.group({
    programId: ['', Validators.required],
    period: this.fb.control(new Date(new Date().getFullYear(), new Date().getMonth(), 1), {
      nonNullable: true,
      validators: Validators.required,
    }),
    status: ['DRAFT' as ContractStatus, Validators.required],
    representatives: this.fb.array([this.personGroup()]),
    institution: this.fb.group({
      name: ['', Validators.required],
      address: ['', Validators.required],
      course: ['', Validators.required],
    }),
    clientRepresentatives: this.fb.array([this.personGroup({}, true)]),
    trip: this.fb.group({
      city: ['', Validators.required],
      contractDate: [null as Date | null, Validators.required],
      destination: ['', Validators.required],
      travelRange: this.fb.control<Date[] | null>(null, optionalTravelRangeValidator),
      days: [0, [Validators.required, Validators.min(1)]],
      nights: [0, [Validators.required, Validators.min(0)]],
      departurePoint: ['', Validators.required],
    }),
    plan: this.fb.group({
      name: ['', Validators.required],
      servicesIncluded: this.fb.array([this.serviceGroup()]),
    }),
    payments: this.fb.group({
      totalPassengers: [{ value: 0, disabled: true }, Validators.required],
      freePassengers: [0, [Validators.required, Validators.min(0)]],
      pricePerPerson: [0, [Validators.required, Validators.min(1)]],
      totalGroup: [{ value: 0, disabled: true }, Validators.required],
      downPayment: [0, [Validators.required, Validators.min(0)]],
      groupBalance: [{ value: 0, disabled: true }, Validators.required],
      daysBeforePayment: [10, [Validators.required, Validators.min(0)]],
      maxExchangeRate: [0, [Validators.required, Validators.min(1)]],
      discountPercentage: [0, [Validators.min(0), Validators.max(100)]],
      bankAccountId: ['', Validators.required],
      installments: this.fb.group(
        {
          quantity: [0, [Validators.required, Validators.min(1)]],
          groupInstallmentValue: [{ value: 0, disabled: true }, Validators.required],
          individualInstallmentValue: [{ value: 0, disabled: true }, Validators.required],
          installmentStartDate: this.fb.control<Date | null>(null, Validators.required),
          startMonth: [''],
          startYear: this.fb.control<number | null>(null),
          startDay: this.fb.control<number | null>(null),
        },
        { validators: installmentStartValidator },
      ),
      conditions: this.fb.group({
        refundPolicyVersion: [2],
        depositPercentageWithFlight: [65, Validators.required],
        depositPercentageWithoutFlight: [20, Validators.required],
        specialProgramDeposit: [3000000, Validators.required],
        daysBeforeFlightBalance: [30, Validators.required],
        daysBeforeTerrestrialBalance: [10, Validators.required],
        cancellationPenaltyPercentage: [0],
        cancellationNoticeDays: [35, Validators.required],
        complaintDeadlineDays: [30, Validators.required],
      }),
      bankAccount: this.fb.group({
        accountNumber: ['', Validators.required],
        accountHolder: ['', Validators.required],
        holderDNI: ['', [Validators.required, rutValidator]],
        bank: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
      }),
    }),
    passengers: this.fb.array([this.passengerGroup()]),
  });

  protected readonly historicalRefundPolicy = signal(false);

  constructor() {
    this.setupPaymentCalculation();
    this.setupDependentFields();
    this.setupInstallmentStartDate();
    const id = this.route.snapshot.paramMap.get('id');
    this.loadInitialData(id !== null);
    if (id) this.load(id);
  }

  protected get representatives(): FormArray {
    return this.form.controls.representatives;
  }
  protected get clientRepresentatives(): FormArray {
    return this.form.controls.clientRepresentatives;
  }
  protected get passengers(): FormArray {
    return this.form.controls.passengers;
  }
  protected get services(): FormArray {
    return this.form.controls.plan.controls.servicesIncluded;
  }
  protected addRepresentative(client = false): void {
    (client ? this.clientRepresentatives : this.representatives).push(
      this.personGroup(
        { course: client ? (this.form.controls.institution.controls.course.value ?? '') : '' },
        client,
      ),
    );
  }
  protected addPassenger(): void {
    this.passengers.push(this.passengerGroup());
  }
  protected addService(): void {
    this.services.push(this.serviceGroup());
  }
  protected remove(array: FormArray, index: number): void {
    if (array.length > 1) array.removeAt(index);
  }

  protected selectBank(bankId: string | null): void {
    const bank = this.configuration()?.bankAccounts.find(({ id }) => id === bankId);
    if (!bank) {
      this.form.controls.payments.controls.bankAccount.reset();
      return;
    }
    this.form.controls.payments.controls.bankAccount.setValue({
      accountNumber: bank.accountNumber,
      accountHolder: bank.accountHolder,
      holderDNI: bank.holderDNI,
      bank: `${bank.bank} · Cuenta ${bank.accountType}`,
      email: bank.email,
    });
  }

  protected selectTravelStart(): void {
    const control = this.form.controls.trip.controls.travelRange;
    const start = control.value?.[0];
    const days = this.form.controls.trip.controls.days.value ?? 0;
    if (!(start instanceof Date) || days < 1) return;
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    control.setValue([start, end], { emitEvent: false });
  }

  protected selectProgram(programId: string | null): void {
    if (!programId) {
      this.programReference.set(null);
      return;
    }
    if (!this.programs().some(({ id }) => id === programId)) return;
    this.programsLoading.set(true);
    this.favoritesApi
      .get(programId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.programsLoading.set(false)),
      )
      .subscribe({
        next: (program) => this.applyProgram(program),
        error: () => this.notifications.error(APP_MESSAGES.programs.favoriteOperationError),
      });
  }

  private applyProgram(program: Favorite): void {
    const content = program.content;
    const exchange = content.pricing.exchange;
    const effectiveRates = exchange ? buildEffectiveRates(content.pricing, exchange) : null;
    const pricePerPerson = effectiveRates
      ? calculateProgram({
          schedule: content.schedule,
          pricing: content.pricing,
          rates: effectiveRates,
          crews: content.crews,
          services: content.services,
        }).totals.totalPerPassengerCLP
      : (content.totals?.totalPerPassengerCLP ?? 0);
    this.programReference.set({
      id: program.id,
      name: program.name,
      updatedAt: program.updatedAt,
      content: structuredClone(content) as unknown as Record<string, unknown>,
    });
    this.form.patchValue({
      programId: program.id,
      trip: {
        city: content.generals.departureCity,
        destination: content.generals.destination.display,
        days: content.schedule.totalDays,
        nights: content.schedule.totalNights,
      },
      plan: { name: content.generals.name || program.name },
      payments: {
        freePassengers: content.schedule.freePassengers,
        pricePerPerson,
        maxExchangeRate: effectiveRates?.USD ?? content.pricing.usdIncreaseCLP,
      },
    });
    this.replaceArray(this.services, content.services, (service) =>
      this.serviceGroup(service.name),
    );
    this.recalculatePayments();
  }

  protected async importExcel(file: File | undefined, uploader: FileUpload): Promise<void> {
    if (!file || this.locked()) return;
    this.importing.set(true);
    try {
      const patch = await this.importer.parse(file);
      if (patch.institution) this.form.controls.institution.patchValue(patch.institution);
      if (patch.trip) this.form.controls.trip.patchValue(patch.trip);
      if (patch.clientRepresentatives?.length)
        this.replaceArray(this.clientRepresentatives, patch.clientRepresentatives, (value) =>
          this.personGroup(value, true),
        );
      this.syncClientCourse();
      this.replaceArray(this.passengers, patch.passengers, (value) => this.passengerGroup(value));
      this.recalculatePayments();
      this.notifications.success(APP_MESSAGES.contracts.excelImported(patch.passengers.length));
    } catch (error) {
      this.notifications.error(
        error instanceof Error ? error.message : APP_MESSAGES.contracts.excelReadError,
      );
    } finally {
      this.importing.set(false);
      uploader.clear();
    }
  }

  protected save(): void {
    if (this.locked() || this.busy()) return;
    if (this.passengers.length === 0 || this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warn(APP_MESSAGES.forms.reviewRequiredData);
      return;
    }
    const content = this.content();
    this.busy.set(true);
    const id = this.contractId();
    const request$ = id
      ? this.api.update(id, {
          programId: this.form.controls.programId.value || undefined,
          programReference: this.programReference() ?? undefined,
          period: this.periodValue(this.form.controls.period.value),
          status: this.form.controls.status.value ?? 'DRAFT',
          content,
          version: this.version(),
        })
      : this.api.create({
          programId: this.form.controls.programId.value || undefined,
          programReference: this.programReference() ?? undefined,
          period: this.periodValue(this.form.controls.period.value),
          content,
        });
    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (contract) => {
          this.applyContract(contract);
          this.notifications.success(APP_MESSAGES.contracts.saved);
        },
      });
  }

  protected changeStatus(nextStatus: ContractStatus): void {
    const id = this.contractId();
    if (!id || this.locked() || this.busy() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.api
      .update(id, {
        programId: this.form.controls.programId.value || undefined,
        programReference: this.programReference() ?? undefined,
        period: this.periodValue(this.form.controls.period.value),
        status: nextStatus,
        content: this.content(),
        version: this.version(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (contract) => {
          this.applyContract(contract);
          const message =
            nextStatus === 'PENDING_APPROVAL'
              ? APP_MESSAGES.contracts.pendingApproval
              : nextStatus === 'REJECTED'
                ? APP_MESSAGES.contracts.rejected
                : nextStatus === 'CANCELLED'
                  ? APP_MESSAGES.contracts.cancelled
                  : APP_MESSAGES.contracts.returnedToDraft;
          this.notifications.success(message);
        },
      });
  }

  protected statusLabel(): string {
    return (
      {
        DRAFT: 'Borrador',
        PENDING_APPROVAL: 'Pendiente de aprobación',
        APPROVED: 'Aprobado',
        REJECTED: 'Rechazado',
        CANCELLED: 'Cancelado',
      } as const
    )[this.status()];
  }

  protected uploadSignedDocument(file: File | undefined, uploader: FileUpload): void {
    const contractId = this.contractId();
    if (!contractId || !file || this.signedUploadBusy()) return;
    if (
      !file.name.toLowerCase().endsWith('.pdf') ||
      file.size < 5 ||
      file.size > 25 * 1024 * 1024
    ) {
      this.notifications.error('Selecciona un PDF válido de hasta 25 MiB.');
      uploader.clear();
      return;
    }
    if (!this.confirmsAllSignatures()) {
      this.notifications.warn(
        'Confirma que el documento corresponde al contrato y contiene todas las firmas.',
      );
      uploader.clear();
      return;
    }
    if (this.signedDocument() && !this.replacementReason().trim()) {
      this.notifications.warn('Indica el motivo por el que reemplazas la copia firmada vigente.');
      uploader.clear();
      return;
    }
    const clientRequestId = crypto.randomUUID();
    this.signedUploadBusy.set(true);
    from(sha256File(file))
      .pipe(
        switchMap((sha256) =>
          this.api.prepareSignedDocument(contractId, {
            clientRequestId,
            size: file.size,
            sha256,
            currentDocumentId: this.signedDocument()?.id ?? '',
            replacementReason: this.replacementReason().trim(),
            confirmsAllSignatures: true,
          }),
        ),
        switchMap((preparation) =>
          preparation.status === 'COMPLETED'
            ? this.api.get(contractId)
            : preparation.uploadUrl
              ? this.api.uploadSignedDocument(preparation.uploadUrl, file).pipe(
                  switchMap(() => this.api.finalizeSignedDocument(contractId, clientRequestId)),
                  switchMap(() => this.api.get(contractId)),
                )
              : throwError(() => new Error('La API no entregó una URL de carga.')),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.signedUploadBusy.set(false);
          uploader.clear();
        }),
      )
      .subscribe({
        next: (contract) => {
          this.applyContract(contract);
          this.confirmsAllSignatures.set(false);
          this.replacementReason.set('');
          this.notifications.success(
            'La copia firmada quedó publicada y vinculada al contrato aprobado.',
          );
        },
        error: () =>
          this.notifications.error(
            'No se pudo publicar la copia firmada. Revisa el archivo y vuelve a intentarlo.',
          ),
      });
  }

  protected viewSignedDocument(document?: ContractSignedDocument): void {
    const contractId = this.contractId();
    if (!contractId || this.signedUploadBusy()) return;
    this.signedUploadBusy.set(true);
    this.api
      .getSignedDocumentPdf(contractId, document?.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.signedUploadBusy.set(false)),
      )
      .subscribe(({ url }) =>
        this.documentPreview.open({
          title: 'Contrato firmado',
          description:
            document?.replacementReason || 'Copia firmada presencialmente por las partes.',
          documents: [{ name: 'contrato-firmado.pdf', mimeType: 'application/pdf', source: url }],
        }),
      );
  }

  protected loadMoreSignedDocuments(): void {
    const contractId = this.contractId();
    const cursor = this.signedDocumentsNextCursor();
    if (contractId && cursor) this.loadSignedDocuments(contractId, cursor, true);
  }

  private loadSignedDocuments(contractId: string, cursor = '', append = false): void {
    this.api
      .listSignedDocuments(contractId, cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, nextCursor }) => {
          const documents = append ? [...this.signedDocuments(), ...items] : items;
          this.signedDocuments.set(
            documents.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
          );
          this.signedDocumentsNextCursor.set(nextCursor ?? '');
        },
        error: () => {
          if (!append) this.signedDocuments.set([]);
          this.signedDocumentsNextCursor.set('');
        },
      });
  }

  protected preview(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      this.requiredMessages().forEach((message) => message.refresh());
      if (this.form.invalid) {
        const fields = getInvalidContractFields(this.form);
        const visibleFields = fields.slice(0, 8);
        const remainder = fields.length - visibleFields.length;
        this.notifications.warn(
          APP_MESSAGES.forms.incompleteFields(visibleFields, remainder),
          8000,
        );
      }
      return;
    }
    const id = this.contractId();
    const document$: Observable<Blob | ContractPDFAccess> =
      this.status() === 'APPROVED' && id
        ? this.api.getApprovedPdf(id)
        : this.api.generatePdf(this.content(), true);
    this.busy.set(true);
    document$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (document: Blob | ContractPDFAccess) => {
          const source = document instanceof Blob ? document : document.url;
          const ref = this.documentPreview.open({
            title: this.status() === 'APPROVED' ? 'Contrato aprobado' : 'Vista previa del contrato',
            description:
              this.status() === 'APPROVED'
                ? 'Este es el documento definitivo almacenado al aprobar el contrato.'
                : 'Revisa el contenido completo antes de enviarlo a aprobación.',
            documents: [
              {
                name: 'contrato-prestacion-servicios.pdf',
                mimeType: 'application/pdf',
                source,
              },
            ],
            primaryAction:
              this.status() === 'PENDING_APPROVAL' && id
                ? {
                    id: 'approve',
                    label: 'Aprobar contrato',
                    icon: 'pi pi-check-circle',
                    severity: 'success',
                    confirmationMessage:
                      'El PDF se guardará como definitivo y el contrato ya no podrá modificarse.',
                  }
                : undefined,
          });
          ref.onClose
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((result: { action?: string } | undefined) => {
              if (result?.action === 'approve') this.approve();
            });
        },
      });
  }

  private approve(): void {
    const id = this.contractId();
    if (!id || this.status() !== 'PENDING_APPROVAL' || this.busy()) return;
    this.busy.set(true);
    this.api
      .update(id, {
        programId: this.form.controls.programId.value || undefined,
        programReference: this.programReference() ?? undefined,
        period: this.periodValue(this.form.controls.period.value),
        status: 'APPROVED',
        content: this.content(),
        version: this.version(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (contract) => {
          this.applyContract(contract);
          this.notifications.success(APP_MESSAGES.contracts.approved);
        },
      });
  }

  private load(id: string): void {
    this.busy.set(true);
    this.api
      .get(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({ next: (contract) => this.applyContract(contract) });
  }
  private applyContract(contract: Contract): void {
    this.contractId.set(contract.id);
    this.version.set(contract.version);
    this.status.set(contract.status);
    this.locked.set(contract.status === 'APPROVED' || contract.status === 'CANCELLED');
    this.signatureStatus.set(
      contract.signatureStatus ??
        (contract.status === 'APPROVED' ? 'PENDING_SIGNED_UPLOAD' : 'NOT_REQUIRED'),
    );
    this.signedDocument.set(contract.signedDocument ?? null);
    if (contract.status === 'APPROVED') this.loadSignedDocuments(contract.id);
    else {
      this.signedDocuments.set([]);
      this.signedDocumentsNextCursor.set('');
    }
    this.historicalRefundPolicy.set(
      this.locked() && (contract.content.payments.conditions.refundPolicyVersion ?? 0) < 2,
    );
    this.programReference.set(contract.programReference ?? null);
    this.form.patchValue({
      programId: contract.programId ?? '',
      period: this.periodObject(contract.period),
      status: contract.status,
      institution: contract.content.institution,
      trip: {
        city: contract.content.trip.city,
        contractDate: this.dateObject(contract.content.trip.contractDate),
        destination: contract.content.trip.destination,
        days: contract.content.trip.days,
        travelRange:
          contract.content.trip.departureDate && contract.content.trip.returnDate
            ? [
                this.dateObject(contract.content.trip.departureDate)!,
                this.dateObject(contract.content.trip.returnDate)!,
              ]
            : null,
        nights: contract.content.trip.nights,
        departurePoint: contract.content.trip.departurePoint,
      },
      plan: { name: contract.content.plan.name },
      payments: {
        ...contract.content.payments,
        installments: {
          ...contract.content.payments.installments,
          startMonth: String(
            installmentMonthNumber(contract.content.payments.installments.startMonth),
          ).padStart(2, '0'),
          startYear: contract.content.payments.installments.startYear ?? null,
          startDay: contract.content.payments.installments.startDay ?? null,
        },
      },
    });
    this.form.controls.payments.controls.installments.controls.installmentStartDate.setValue(
      this.installmentDate(
        contract.content.payments.installments.startYear,
        contract.content.payments.installments.startMonth,
        contract.content.payments.installments.startDay,
      ),
      { emitEvent: false },
    );
    this.form.controls.payments.controls.conditions.patchValue({
      refundPolicyVersion: this.historicalRefundPolicy() ? 0 : 2,
      cancellationPenaltyPercentage: this.historicalRefundPolicy()
        ? contract.content.payments.conditions.cancellationPenaltyPercentage
        : 0,
    });
    this.replaceArray(this.representatives, contract.content.representatives, (value) =>
      this.personGroup(value),
    );
    this.replaceArray(this.clientRepresentatives, contract.content.clientRepresentatives, (value) =>
      this.personGroup(value, true),
    );
    this.replaceArray(this.services, contract.content.plan.servicesIncluded, (value) =>
      this.serviceGroup(value.description),
    );
    this.replaceArray(this.passengers, contract.content.passengers, (value) =>
      this.passengerGroup(value),
    );
    this.recalculatePayments();
    this.syncBankSelection(contract.content.payments.bankAccount);
    if (this.locked()) this.form.disable();
  }
  private content(): ContractContent {
    const raw = this.form.getRawValue();
    const [departureDate, returnDate] = raw.trip.travelRange ?? [];
    const { travelRange: _, ...trip } = raw.trip;
    const { bankAccountId: __, ...paymentsWithInternalDate } = raw.payments;
    const { installmentStartDate: ___, ...installments } = paymentsWithInternalDate.installments;
    const payments = { ...paymentsWithInternalDate, installments };
    return {
      representatives: raw.representatives,
      institution: raw.institution,
      clientRepresentatives: raw.clientRepresentatives,
      trip: {
        ...trip,
        contractDate: this.dateValue(raw.trip.contractDate),
        departureDate: this.dateValue(departureDate),
        returnDate: this.dateValue(returnDate),
      },
      plan: raw.plan,
      payments,
      passengers: raw.passengers.map((passenger) => ({
        ...passenger,
        birthDate: this.dateValue(passenger['birthDate']),
      })),
    } as ContractContent;
  }
  private personGroup(
    value: Partial<{ name: string; dni: string; course: string }> = {},
    courseRequired = false,
  ): FormGroup {
    return this.fb.group({
      name: [value.name ?? '', Validators.required],
      dni: [value.dni ?? '', [Validators.required, rutValidator]],
      course: [value.course ?? '', courseRequired ? Validators.required : []],
    });
  }
  private passengerGroup(
    value = { names: '', lastNames: '', dni: '', birthDate: '', nationality: '', sex: '' },
  ): FormGroup {
    return this.fb.group({
      names: [value.names, Validators.required],
      lastNames: [value.lastNames, Validators.required],
      dni: [value.dni, [Validators.required, rutValidator]],
      birthDate: [this.dateObject(value.birthDate), [Validators.required, birthDateValidator]],
      nationality: [value.nationality, Validators.required],
      sex: [value.sex, Validators.required],
    });
  }
  private replaceArray<T>(array: FormArray, values: T[], build: (value: T) => FormGroup): void {
    reconcileFormArray(array, values, build);
  }

  private serviceGroup(description = ''): FormGroup {
    return this.fb.group({ description: [description, Validators.required] });
  }

  private dateObject(value: string | Date | null | undefined): Date | null {
    if (value instanceof Date) return value;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }

  private dateValue(value: unknown): string {
    if (!(value instanceof Date)) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private installmentDate(
    year: number | undefined,
    month: string,
    day: number | undefined,
  ): Date | null {
    if (!year || !day) return null;
    const monthIndex = installmentMonthNumber(month) - 1;
    const value = new Date(year, monthIndex, day);
    return value.getFullYear() === year &&
      value.getMonth() === monthIndex &&
      value.getDate() === day
      ? value
      : null;
  }

  private periodObject(value: string): Date {
    const match = /^(\d{4})-(\d{2})/.exec(value);
    return match
      ? new Date(Number(match[1]), Number(match[2]) - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }

  private periodValue(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  private loadInitialData(editing: boolean): void {
    this.programsLoading.set(true);
    forkJoin({
      programs: this.favoritesApi.list('cotizacion'),
      configuration: this.api.getConfiguration('CTX'),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.programsLoading.set(false)),
      )
      .subscribe({
        next: ({ programs, configuration }) => {
          this.programs.set(programs);
          this.configuration.set(configuration);
          if (!editing) this.applyInitialConfiguration(configuration);
          else
            this.syncBankSelection(this.form.controls.payments.controls.bankAccount.getRawValue());
        },
        error: () => {
          this.programs.set([]);
          this.notifications.error(APP_MESSAGES.contracts.initialConfigurationError);
        },
      });
  }

  private applyInitialConfiguration(configuration: ContractFormConfiguration): void {
    this.replaceArray(this.representatives, configuration.companyRepresentatives, (value) =>
      this.personGroup({ ...value, course: value.course || 'Representante legal' }),
    );
    const firstBank = configuration.bankAccounts[0];
    this.form.controls.payments.patchValue({
      daysBeforePayment: configuration.defaults.daysBeforePayment,
      conditions: { specialProgramDeposit: configuration.defaults.specialProgramDeposit },
      bankAccountId: firstBank?.id ?? '',
    });
    this.selectBank(firstBank?.id ?? null);
  }

  private setupDependentFields(): void {
    this.form.controls.institution.controls.course.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncClientCourse());
    this.form.controls.trip.controls.days.valueChanges
      .pipe(skip(1), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.trip.controls.travelRange.reset());
  }

  private setupInstallmentStartDate(): void {
    this.form.controls.payments.controls.installments.controls.installmentStartDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const installments = this.form.controls.payments.controls.installments;
        installments.patchValue(
          value instanceof Date && !Number.isNaN(value.getTime())
            ? {
                startMonth: String(value.getMonth() + 1).padStart(2, '0'),
                startYear: value.getFullYear(),
                startDay: value.getDate(),
              }
            : { startMonth: '', startYear: null, startDay: null },
        );
      });
  }

  private syncClientCourse(): void {
    const course = this.form.controls.institution.controls.course.value ?? '';
    for (const representative of this.clientRepresentatives.controls) {
      representative.get('course')?.setValue(course);
    }
  }

  private syncBankSelection(account: {
    accountNumber?: string | null;
    accountHolder?: string | null;
    holderDNI?: string | null;
    bank?: string | null;
    email?: string | null;
  }): void {
    const bank = this.configuration()?.bankAccounts.find(
      ({ accountNumber }) => accountNumber === account.accountNumber,
    );
    if (bank) this.form.controls.payments.controls.bankAccountId.setValue(bank.id);
  }

  private setupPaymentCalculation(): void {
    const payments = this.form.controls.payments.controls;
    merge(
      this.passengers.valueChanges,
      payments.freePassengers.valueChanges,
      payments.pricePerPerson.valueChanges,
      payments.downPayment.valueChanges,
      payments.installments.controls.quantity.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculatePayments());
    this.recalculatePayments();
  }

  private recalculatePayments(): void {
    const payments = this.form.controls.payments.controls;
    const passengerCount = this.passengers.controls.filter((passenger) =>
      Object.values(passenger.getRawValue()).some(Boolean),
    ).length;
    const enteredFreePassengers = payments.freePassengers.value ?? 0;
    const calculated = calculateContractPayments({
      passengerCount,
      freePassengers: Math.max(0, Math.trunc(enteredFreePassengers)),
      pricePerPerson: payments.pricePerPerson.value ?? 0,
      downPayment: payments.downPayment.value ?? 0,
      installmentQuantity: payments.installments.controls.quantity.value ?? 0,
    });
    payments.totalPassengers.setValue(calculated.payingPassengers, { emitEvent: false });
    payments.totalGroup.setValue(calculated.totalGroup, { emitEvent: false });
    payments.groupBalance.setValue(calculated.groupBalance, { emitEvent: false });
    payments.installments.controls.groupInstallmentValue.setValue(
      calculated.groupInstallmentValue,
      { emitEvent: false },
    );
    payments.installments.controls.individualInstallmentValue.setValue(
      calculated.individualInstallmentValue,
      { emitEvent: false },
    );
  }
}

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { DocumentPreviewService } from '../../../../shared/documents/services/document-preview.service';
import { newUlid } from '../../../../shared/fn/new-ulid';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import type {
  Contract,
  ContractAmendment,
  ContractAmendmentCreateRequest,
} from '../../interfaces/contract.interface';
import { ContractsService } from '../../services/contracts.service';

@Component({
  selector: 'app-contract-amendments-page',
  imports: [
    ButtonDirective,
    Checkbox,
    DatePipe,
    DateOnlyPickerComponent,
    InputNumber,
    InputText,
    Message,
    ReactiveFormsModule,
    RouterLink,
    TableModule,
    Textarea,
  ],
  templateUrl: './contract-amendments.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractAmendmentsPage {
  private readonly api = inject(ContractsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly documentPreview = inject(DocumentPreviewService);
  private pendingRequest: ContractAmendmentCreateRequest | null = null;

  protected readonly contractId = signal('');
  protected readonly contract = signal<Contract | null>(null);
  protected readonly amendments = signal<ContractAmendment[]>([]);
  protected readonly currentDraft = signal<ContractAmendment | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly reviewed = new FormControl(false, { nonNullable: true });
  protected readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    departureDate: new FormControl('', { nonNullable: true }),
    returnDate: new FormControl('', { nonNullable: true }),
    days: new FormControl(1, { nonNullable: true, validators: [Validators.min(1)] }),
    nights: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    services: new FormArray<FormControl<string>>([]),
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.contractId.set(params.get('id') ?? '');
      void this.initialize();
    });
  }

  protected addService(value = ''): void {
    this.form.controls.services.push(
      new FormControl(value, {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(1000)],
      }),
    );
  }

  protected removeService(index: number): void {
    if (this.form.controls.services.length > 1) this.form.controls.services.removeAt(index);
  }

  protected async createDraft(): Promise<void> {
    const contract = this.contract();
    if (!contract || this.currentDraft() || this.busy()) return;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const hasOneDate = Boolean(value.departureDate) !== Boolean(value.returnDate);
    if (this.form.invalid || hasOneDate) {
      this.error.set('Completa el motivo, ambos extremos de la fecha y todos los servicios.');
      return;
    }
    if (!this.pendingRequest) {
      this.pendingRequest = {
        id: newUlid(),
        baseContractVersion: contract.version,
        reason: value.reason.trim(),
        after: {
          departureDate: value.departureDate,
          returnDate: value.returnDate,
          days: value.days,
          nights: value.nights,
          services: value.services.map((description) => ({ description: description.trim() })),
        },
      };
      this.form.disable();
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const draft = await firstValueFrom(
        this.api.createAmendment(this.contractId(), this.pendingRequest),
      );
      this.currentDraft.set(draft);
      this.mergeAmendment(draft);
    } catch {
      this.error.set(
        'No se confirmó la creación. Reintenta sin recargar para conservar la misma clave.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async approve(): Promise<void> {
    const draft = this.currentDraft();
    if (!draft || !this.reviewed.value || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const approved = await firstValueFrom(
        this.api.approveAmendment(this.contractId(), draft.id, draft.version),
      );
      this.currentDraft.set(null);
      this.reviewed.setValue(false);
      this.mergeAmendment(approved);
    } catch {
      this.error.set(
        'No se confirmó la aprobación. Reintenta sobre el mismo anexo; no crees otro borrador.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected viewPdf(amendment: ContractAmendment): void {
    this.busy.set(true);
    this.api
      .getApprovedAmendmentPdf(this.contractId(), amendment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ url }) => {
          this.busy.set(false);
          this.documentPreview.open({
            title: 'Anexo contractual aprobado',
            description: amendment.reason,
            documents: [
              { name: `anexo-${amendment.id}.pdf`, mimeType: 'application/pdf', source: url },
            ],
          });
        },
        error: () => {
          this.busy.set(false);
          this.error.set('No se pudo verificar o descargar el PDF aprobado.');
        },
      });
  }

  private async initialize(): Promise<void> {
    const id = this.contractId();
    this.loading.set(true);
    this.error.set('');
    try {
      const [contract, amendments] = await Promise.all([
        firstValueFrom(this.api.get(id)),
        this.loadAllAmendments(id),
      ]);
      if (this.contractId() !== id) return;
      if (contract.status !== 'APPROVED') {
        this.error.set('Solo se pueden anexar contratos aprobados.');
        return;
      }
      this.contract.set(contract);
      this.amendments.set(amendments);
      const draft = amendments.find(({ status }) => status === 'DRAFT') ?? null;
      this.currentDraft.set(draft);
      const latestApproved = amendments
        .filter(({ status }) => status === 'APPROVED')
        .sort((a, b) => b.baseTermsRevision - a.baseTermsRevision)[0];
      this.populateForm(contract, draft, latestApproved);
    } catch {
      if (this.contractId() === id) this.error.set('No se pudo cargar el contrato y sus anexos.');
    } finally {
      if (this.contractId() === id) this.loading.set(false);
    }
  }

  private populateForm(
    contract: Contract,
    draft: ContractAmendment | null,
    latestApproved?: ContractAmendment,
  ): void {
    const source = draft?.after ??
      latestApproved?.after ?? {
        departureDate: contract.content.trip.departureDate,
        returnDate: contract.content.trip.returnDate,
        days: contract.content.trip.days,
        nights: contract.content.trip.nights,
        services: contract.content.plan.servicesIncluded,
      };
    this.form.controls.services.clear();
    for (const service of source.services) this.addService(service.description);
    this.form.patchValue({
      reason: draft?.reason ?? '',
      departureDate: this.dateInput(source.departureDate),
      returnDate: this.dateInput(source.returnDate),
      days: source.days,
      nights: source.nights,
    });
    if (draft) this.form.disable();
    else this.form.enable();
  }

  private async loadAllAmendments(contractId: string): Promise<ContractAmendment[]> {
    const items: ContractAmendment[] = [];
    let cursor = '';
    do {
      const page = await firstValueFrom(this.api.listAmendments(contractId, cursor));
      items.push(...page.items);
      cursor = page.nextCursor ?? '';
    } while (cursor);
    return items;
  }

  private mergeAmendment(amendment: ContractAmendment): void {
    this.amendments.update((items) => [
      amendment,
      ...items.filter(({ id }) => id !== amendment.id),
    ]);
  }

  private dateInput(value: string): string {
    return value ? value.slice(0, 10) : '';
  }
}

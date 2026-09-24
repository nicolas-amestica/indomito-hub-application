import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ContractExcelImporter } from '../../importers/contract-excel.importer';
import type { Contract, ContractContent, ContractStatus } from '../../interfaces/contract.interface';
import { ContractsService } from '../../services/contracts.service';
import { ContractTemplateService } from '../../services/contract-template.service';

@Component({
  selector: 'app-contract-form-page',
  imports: [ReactiveFormsModule],
  templateUrl: './contract-form.page.html',
  styles: [`
    .field { display: flex; flex-direction: column; gap: .45rem; color: rgb(23 32 51 / .72); font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    input, select, textarea { border: 1px solid rgb(0 0 0 / .14); border-radius: .7rem; background: white; padding: .7rem .8rem; color: #172033; font-size: .9rem; font-weight: 400; text-transform: none; letter-spacing: normal; }
    input:focus, select:focus, textarea:focus { outline: 2px solid rgb(20 184 166 / .25); border-color: #0f766e; }
    input:disabled, select:disabled, textarea:disabled { background: #f3f4f6; color: #6b7280; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractFormPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ContractsService);
  protected readonly template = inject(ContractTemplateService);
  private readonly importer = inject(ContractExcelImporter);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  protected readonly busy = signal(false);
  protected readonly importing = signal(false);
  protected readonly contractId = signal<string | null>(null);
  protected readonly version = signal(0);
  protected readonly status = signal<ContractStatus>('DRAFT');
  protected readonly locked = signal(false);

  protected readonly form = this.fb.group({
    programId: [''], period: [new Date().toISOString().slice(0, 7)], status: ['DRAFT' as ContractStatus],
    representatives: this.fb.array([this.personGroup()]),
    institution: this.fb.group({ name: [''], address: [''] }),
    clientRepresentatives: this.fb.array([this.personGroup()]),
    trip: this.fb.group({ city: [''], contractDate: [''], destination: [''], departureDate: [''], returnDate: [''], days: [0], nights: [0], departurePoint: [''] }),
    plan: this.fb.group({ name: [''], servicesIncluded: this.fb.array([this.fb.group({ description: [''] })]) }),
    payments: this.fb.group({
      totalPassengers: [0], freePassengers: [0], pricePerPerson: [0], priceInUSD: [0], totalGroup: [0], downPayment: [0], groupBalance: [0], daysBeforePayment: [0], maxExchangeRate: [0],
      installments: this.fb.group({ quantity: [0], groupInstallmentValue: [0], individualInstallmentValue: [0], startMonth: [''] }),
      conditions: this.fb.group({ depositPercentageWithFlight: [65], depositPercentageWithoutFlight: [20], specialProgramDeposit: [0], daysBeforeFlightBalance: [30], daysBeforeTerrestrialBalance: [10], cancellationPenaltyPercentage: [25], cancellationNoticeDays: [35], complaintDeadlineDays: [30] }),
      bankAccount: this.fb.group({ accountNumber: [''], accountHolder: [''], holderDNI: [''], bank: [''], email: [''] }),
    }),
    passengers: this.fb.array([this.passengerGroup()]),
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  protected get representatives(): FormArray { return this.form.controls.representatives; }
  protected get clientRepresentatives(): FormArray { return this.form.controls.clientRepresentatives; }
  protected get passengers(): FormArray { return this.form.controls.passengers; }
  protected get services(): FormArray { return this.form.controls.plan.controls.servicesIncluded; }
  protected addRepresentative(client = false): void { (client ? this.clientRepresentatives : this.representatives).push(this.personGroup()); }
  protected addPassenger(): void { this.passengers.push(this.passengerGroup()); }
  protected addService(): void { this.services.push(this.fb.group({ description: [''] })); }
  protected remove(array: FormArray, index: number): void { if (array.length > 1) array.removeAt(index); }

  protected async importExcel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.locked()) return;
    this.importing.set(true);
    try {
      const patch = await this.importer.parse(file);
      if (patch.institution) this.form.controls.institution.patchValue(patch.institution);
      if (patch.trip) this.form.controls.trip.patchValue(patch.trip);
      if (patch.plan) this.form.controls.plan.patchValue({ name: patch.plan.name });
      if (patch.clientRepresentatives?.length) this.replaceArray(this.clientRepresentatives, patch.clientRepresentatives, (value) => this.personGroup(value));
      this.replaceArray(this.passengers, patch.passengers, (value) => this.passengerGroup(value));
      this.form.controls.payments.patchValue({ totalPassengers: patch.passengers.length });
      this.notifications.success(`Se precargaron ${patch.passengers.length} pasajeros. Los campos siguen editables.`);
    } catch (error) {
      this.notifications.error(error instanceof Error ? error.message : 'No se pudo leer el Excel.');
    } finally { this.importing.set(false); input.value = ''; }
  }

  protected save(): void {
    if (this.locked() || this.busy()) return;
    if (this.passengers.length === 0 || this.passengers.invalid) { this.form.markAllAsTouched(); this.notifications.warn('Completa la lista de pasajeros.'); return; }
    const content = this.content();
    this.busy.set(true);
    const id = this.contractId();
    const request$ = id
      ? this.api.update(id, { period: this.form.controls.period.value ?? '', status: this.form.controls.status.value ?? 'DRAFT', content, version: this.version() })
      : this.api.create({ programId: this.form.controls.programId.value || undefined, period: this.form.controls.period.value || undefined, content });
    request$.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: (contract) => { this.applyContract(contract); this.notifications.success('Contrato guardado correctamente.'); } });
  }

  protected preview(): void {
    if (this.passengers.invalid || this.busy()) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    this.api.generatePdf(this.content(), true).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: (blob) => { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60_000); } });
  }

  private load(id: string): void { this.busy.set(true); this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({ next: (contract) => this.applyContract(contract) }); }
  private applyContract(contract: Contract): void {
    this.contractId.set(contract.id); this.version.set(contract.version); this.status.set(contract.status); this.locked.set(contract.status === 'APPROVED');
    this.form.patchValue({ programId: contract.programId ?? '', period: contract.period, status: contract.status, institution: contract.content.institution, trip: contract.content.trip, plan: { name: contract.content.plan.name }, payments: contract.content.payments });
    this.replaceArray(this.representatives, contract.content.representatives, (value) => this.personGroup(value));
    this.replaceArray(this.clientRepresentatives, contract.content.clientRepresentatives, (value) => this.personGroup(value));
    this.replaceArray(this.services, contract.content.plan.servicesIncluded, (value) => this.fb.group({ description: [value.description] }));
    this.replaceArray(this.passengers, contract.content.passengers, (value) => this.passengerGroup(value));
    if (this.locked()) this.form.disable();
  }
  private content(): ContractContent { const raw = this.form.getRawValue(); return { representatives: raw.representatives, institution: raw.institution, clientRepresentatives: raw.clientRepresentatives, trip: raw.trip, plan: raw.plan, payments: raw.payments, passengers: raw.passengers } as ContractContent; }
  private personGroup(value: Partial<{ name: string; dni: string; course: string }> = {}): FormGroup { return this.fb.group({ name: [value.name ?? ''], dni: [value.dni ?? ''], course: [value.course ?? ''] }); }
  private passengerGroup(value = { names: '', lastNames: '', dni: '', birthDate: '', nationality: '' }): FormGroup { return this.fb.group({ names: [value.names, Validators.required], lastNames: [value.lastNames, Validators.required], dni: [value.dni, Validators.required], birthDate: [value.birthDate, Validators.required], nationality: [value.nationality, Validators.required] }); }
  private replaceArray<T>(array: FormArray, values: T[], build: (value: T) => FormGroup): void { array.clear(); for (const value of values) array.push(build(value)); if (array.length === 0) array.push(build({} as T)); }
}

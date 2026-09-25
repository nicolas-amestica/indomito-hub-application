import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, merge } from 'rxjs';
import { Select } from 'primeng/select';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ContractExcelImporter } from '../../importers/contract-excel.importer';
import type { Favorite } from '../../../programs/interfaces/favorite.interface';
import type { ExchangeSnapshot } from '../../../programs/interfaces/program.interface';
import {
  buildEffectiveRates,
  calculateProgram,
} from '../../../programs/calculation/calculation-engine';
import { ExchangeRateService } from '../../../programs/services/exchange-rate.service';
import { FavoritesService } from '../../../programs/services/favorites.service';
import { calculateContractPayments } from '../../fn/calculate-contract-payments';
import { birthDateValidator, rutValidator } from '../../fn/contract-validators';
import type {
  Contract,
  ContractContent,
  ContractProgramReference,
  ContractStatus,
} from '../../interfaces/contract.interface';
import { ContractsService } from '../../services/contracts.service';
import { ContractTemplateService } from '../../services/contract-template.service';

@Component({
  selector: 'app-contract-form-page',
  imports: [ReactiveFormsModule, Select],
  templateUrl: './contract-form.page.html',
  styles: [
    `
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        color: rgb(23 32 51 / 0.72);
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      input,
      select,
      textarea {
        border: 1px solid rgb(0 0 0 / 0.14);
        border-radius: 0.7rem;
        background: white;
        padding: 0.7rem 0.8rem;
        color: #172033;
        font-size: 0.9rem;
        font-weight: 400;
        text-transform: none;
        letter-spacing: normal;
      }
      input:focus,
      select:focus,
      textarea:focus {
        outline: 2px solid rgb(20 184 166 / 0.25);
        border-color: #0f766e;
      }
      input:disabled,
      select:disabled,
      textarea:disabled {
        background: #f3f4f6;
        color: #6b7280;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractFormPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ContractsService);
  private readonly favoritesApi = inject(FavoritesService);
  private readonly exchangeRateApi = inject(ExchangeRateService);
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
  protected readonly programs = signal<Favorite[]>([]);
  protected readonly programsLoading = signal(false);
  private readonly exchangeSnapshot = signal<ExchangeSnapshot | null>(null);
  private readonly programReference = signal<ContractProgramReference | null>(null);

  protected readonly form = this.fb.group({
    programId: [''],
    period: [new Date().toISOString().slice(0, 7)],
    status: ['DRAFT' as ContractStatus],
    representatives: this.fb.array([this.personGroup()]),
    institution: this.fb.group({ name: [''], address: [''], course: [''] }),
    clientRepresentatives: this.fb.array([this.personGroup()]),
    trip: this.fb.group({
      city: [''],
      contractDate: [''],
      destination: [''],
      departureDate: [''],
      returnDate: [''],
      days: [0],
      nights: [0],
      departurePoint: [''],
    }),
    plan: this.fb.group({
      name: [''],
      servicesIncluded: this.fb.array([this.fb.group({ description: [''] })]),
    }),
    payments: this.fb.group({
      totalPassengers: [{ value: 0, disabled: true }],
      freePassengers: [0],
      pricePerPerson: [0],
      totalGroup: [{ value: 0, disabled: true }],
      downPayment: [0],
      groupBalance: [{ value: 0, disabled: true }],
      daysBeforePayment: [0],
      maxExchangeRate: [0],
      installments: this.fb.group({
        quantity: [0],
        groupInstallmentValue: [{ value: 0, disabled: true }],
        individualInstallmentValue: [{ value: 0, disabled: true }],
        startMonth: [''],
      }),
      conditions: this.fb.group({
        depositPercentageWithFlight: [65],
        depositPercentageWithoutFlight: [20],
        specialProgramDeposit: [0],
        daysBeforeFlightBalance: [30],
        daysBeforeTerrestrialBalance: [10],
        cancellationPenaltyPercentage: [25],
        cancellationNoticeDays: [35],
        complaintDeadlineDays: [30],
      }),
      bankAccount: this.fb.group({
        accountNumber: [''],
        accountHolder: [''],
        holderDNI: [''],
        bank: [''],
        email: [''],
      }),
    }),
    passengers: this.fb.array([this.passengerGroup()]),
  });

  constructor() {
    this.loadPrograms();
    this.setupPaymentCalculation();
    const id = this.route.snapshot.paramMap.get('id');
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
    (client ? this.clientRepresentatives : this.representatives).push(this.personGroup());
  }
  protected addPassenger(): void {
    this.passengers.push(this.passengerGroup());
  }
  protected addService(): void {
    this.services.push(this.fb.group({ description: [''] }));
  }
  protected remove(array: FormArray, index: number): void {
    if (array.length > 1) array.removeAt(index);
  }

  protected selectProgram(programId: string | null): void {
    if (!programId) {
      this.programReference.set(null);
      return;
    }
    const program = this.programs().find(({ id }) => id === programId);
    if (!program) return;
    const content = program.content;
    const exchange = this.exchangeSnapshot();
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
      this.fb.group({ description: [service.name] }),
    );
    this.recalculatePayments();
  }

  protected async importExcel(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.locked()) return;
    this.importing.set(true);
    try {
      const patch = await this.importer.parse(file);
      if (patch.institution) this.form.controls.institution.patchValue(patch.institution);
      if (patch.trip) this.form.controls.trip.patchValue(patch.trip);
      if (patch.clientRepresentatives?.length)
        this.replaceArray(this.clientRepresentatives, patch.clientRepresentatives, (value) =>
          this.personGroup(value),
        );
      this.replaceArray(this.passengers, patch.passengers, (value) => this.passengerGroup(value));
      this.recalculatePayments();
      this.notifications.success(
        `Se precargaron ${patch.passengers.length} pasajeros. Los campos siguen editables.`,
      );
    } catch (error) {
      this.notifications.error(
        error instanceof Error ? error.message : 'No se pudo leer el Excel.',
      );
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }

  protected save(): void {
    if (this.locked() || this.busy()) return;
    if (this.passengers.length === 0 || this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.warn('Revisa los datos obligatorios, los RUT y las fechas.');
      return;
    }
    const content = this.content();
    this.busy.set(true);
    const id = this.contractId();
    const request$ = id
      ? this.api.update(id, {
          programId: this.form.controls.programId.value || undefined,
          programReference: this.programReference() ?? undefined,
          period: this.form.controls.period.value ?? '',
          status: this.form.controls.status.value ?? 'DRAFT',
          content,
          version: this.version(),
        })
      : this.api.create({
          programId: this.form.controls.programId.value || undefined,
          programReference: this.programReference() ?? undefined,
          period: this.form.controls.period.value || undefined,
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
          this.notifications.success('Contrato guardado correctamente.');
        },
      });
  }

  protected preview(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.api
      .generatePdf(this.content(), true)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener,noreferrer');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
    this.locked.set(contract.status === 'APPROVED');
    this.programReference.set(contract.programReference ?? null);
    this.form.patchValue({
      programId: contract.programId ?? '',
      period: contract.period,
      status: contract.status,
      institution: contract.content.institution,
      trip: {
        ...contract.content.trip,
        contractDate: this.dateInput(contract.content.trip.contractDate),
        departureDate: this.dateInput(contract.content.trip.departureDate),
        returnDate: this.dateInput(contract.content.trip.returnDate),
      },
      plan: { name: contract.content.plan.name },
      payments: contract.content.payments,
    });
    this.replaceArray(this.representatives, contract.content.representatives, (value) =>
      this.personGroup(value),
    );
    this.replaceArray(this.clientRepresentatives, contract.content.clientRepresentatives, (value) =>
      this.personGroup(value),
    );
    this.replaceArray(this.services, contract.content.plan.servicesIncluded, (value) =>
      this.fb.group({ description: [value.description] }),
    );
    this.replaceArray(this.passengers, contract.content.passengers, (value) =>
      this.passengerGroup(value),
    );
    this.recalculatePayments();
    if (this.locked()) this.form.disable();
  }
  private content(): ContractContent {
    const raw = this.form.getRawValue();
    return {
      representatives: raw.representatives,
      institution: raw.institution,
      clientRepresentatives: raw.clientRepresentatives,
      trip: raw.trip,
      plan: raw.plan,
      payments: raw.payments,
      passengers: raw.passengers,
    } as ContractContent;
  }
  private personGroup(
    value: Partial<{ name: string; dni: string; course: string }> = {},
  ): FormGroup {
    return this.fb.group({
      name: [value.name ?? ''],
      dni: [value.dni ?? '', rutValidator],
      course: [value.course ?? ''],
    });
  }
  private passengerGroup(
    value = { names: '', lastNames: '', dni: '', birthDate: '', nationality: '', sex: '' },
  ): FormGroup {
    return this.fb.group({
      names: [value.names, Validators.required],
      lastNames: [value.lastNames, Validators.required],
      dni: [value.dni, [Validators.required, rutValidator]],
      birthDate: [this.dateInput(value.birthDate), [Validators.required, birthDateValidator]],
      nationality: [value.nationality, Validators.required],
      sex: [value.sex, Validators.required],
    });
  }
  private replaceArray<T>(array: FormArray, values: T[], build: (value: T) => FormGroup): void {
    array.clear();
    for (const value of values) array.push(build(value));
    if (array.length === 0) array.push(build({} as T));
  }

  private dateInput(value: string): string {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '');
    return match?.[1] ?? '';
  }

  private loadPrograms(): void {
    this.programsLoading.set(true);
    this.favoritesApi
      .list('programa')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.programsLoading.set(false)),
      )
      .subscribe({
        next: (programs) => this.programs.set(programs),
        error: () => this.programs.set([]),
      });
    this.exchangeRateApi
      .getSnapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (snapshot) => this.exchangeSnapshot.set(snapshot) });
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
    const freePassengers =
      passengerCount > 0
        ? Math.min(Math.max(0, Math.trunc(enteredFreePassengers)), Math.max(0, passengerCount - 1))
        : Math.max(0, Math.trunc(enteredFreePassengers));
    if (freePassengers !== enteredFreePassengers) {
      payments.freePassengers.setValue(freePassengers, { emitEvent: false });
    }
    const calculated = calculateContractPayments({
      passengerCount,
      freePassengers,
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

import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { newUlid } from '../../../../shared/fn/new-ulid';
import { DateOnlyPickerComponent } from '../../../../shared/date-only/date-only-picker.component';
import { buildAnnexInstallments } from '../../fn/build-annex-installments';
import type {
  AnnexDraftRequest,
  AnnexImpact,
  AnnexState,
  RosterMember,
} from '../../interfaces/collection-annex.interface';
import { CollectionAnnexes } from '../../services/collection-annexes';

type AdmissionForm = FormGroup<{
  name: FormControl<string>;
  dni: FormControl<string>;
  free: FormControl<boolean>;
  depositAgreed: FormControl<number>;
  installmentQuantity: FormControl<number>;
  installmentAmount: FormControl<number>;
  firstDueDate: FormControl<string>;
  replacesAccountId: FormControl<string>;
}>;

@Component({
  selector: 'app-annex-form',
  imports: [
    DateOnlyPickerComponent,
    CurrencyPipe,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    InputNumber,
    InputText,
    Message,
    Select,
    TableModule,
    Textarea,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './annex-form.page.html',
})
export class AnnexFormPage {
  private readonly api = inject(CollectionAnnexes);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private pendingDraft: AnnexDraftRequest | null = null;

  protected readonly tripId = signal('');
  protected readonly roster = signal<RosterMember[]>([]);
  protected readonly selectedWithdrawals = signal<Set<string>>(new Set());
  protected readonly state = signal<AnnexState | null>(null);
  protected readonly impact = signal<AnnexImpact | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly reviewed = signal(false);
  protected readonly migrationRequired = signal(false);
  protected readonly rosterClosed = signal(false);
  protected readonly rosterClosedAt = signal('');
  protected readonly rosterCloseReason = signal('');
  protected readonly closureReviewed = signal(false);
  protected readonly closureReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
  });
  protected readonly approvalReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
  });
  protected readonly activeRoster = computed(() => this.roster().filter(({ active }) => active));
  protected readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    admissions: new FormArray<AdmissionForm>([]),
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.tripId.set(params.get('id') ?? '');
      void this.initialize(this.route.snapshot.queryParamMap.get('anexo') ?? '');
    });
  }

  protected addAdmission(): void {
    this.form.controls.admissions.push(
      new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        dni: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        free: new FormControl(false, { nonNullable: true }),
        depositAgreed: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
        installmentQuantity: new FormControl(1, {
          nonNullable: true,
          validators: [Validators.min(1), Validators.max(120)],
        }),
        installmentAmount: new FormControl(0, {
          nonNullable: true,
          validators: [Validators.min(0)],
        }),
        firstDueDate: new FormControl('', { nonNullable: true }),
        replacesAccountId: new FormControl('', { nonNullable: true }),
      }),
    );
  }

  protected removeAdmission(index: number): void {
    this.form.controls.admissions.removeAt(index);
  }

  protected selectWithdrawal(accountId: string, selected: boolean): void {
    this.selectedWithdrawals.update((current) => {
      const next = new Set(current);
      if (selected) next.add(accountId);
      else next.delete(accountId);
      return next;
    });
  }

  protected async prepare(): Promise<void> {
    if (this.busy() || this.state()?.status === 'APPLIED') return;
    this.error.set('');
    if (!this.pendingDraft) {
      this.form.markAllAsTouched();
      const request = this.buildRequest();
      if (!request) {
        this.error.set('Revisa el motivo, las bajas y todas las condiciones de cada alta.');
        return;
      }
      this.pendingDraft = request;
      this.form.disable();
    }
    this.busy.set(true);
    try {
      const state = await firstValueFrom(this.api.create(this.tripId(), this.pendingDraft));
      this.state.set(state);
      this.approvalReason.setValue(this.form.controls.reason.getRawValue().trim());
      this.impact.set(await firstValueFrom(this.api.impact(this.tripId(), state.id)));
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { anexo: state.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch {
      this.error.set(
        'No se confirmó la preparación. Reintenta sin editar: se conservará la misma clave.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async apply(): Promise<void> {
    const state = this.state();
    if (
      !state ||
      !['DRAFT', 'VALIDATING', 'APPLYING'].includes(state.status) ||
      !this.reviewed() ||
      this.approvalReason.invalid ||
      this.busy()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.state.set(
        await firstValueFrom(
          this.api.apply(
            this.tripId(),
            state.id,
            state.id,
            this.approvalReason.getRawValue().trim(),
          ),
        ),
      );
    } catch {
      this.error.set(
        'No se confirmó el resultado. Consulta o reintenta con la misma clave; no crees otro anexo.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async migrateRoster(): Promise<void> {
    const tripId = this.tripId();
    if (!tripId || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.api.migrateRoster(
          tripId,
          tripId,
          'Habilitar proyección administrativa de nómina histórica',
        ),
      );
      await this.refreshRoster(tripId);
      this.migrationRequired.set(false);
    } catch {
      this.error.set(
        'No se pudo preparar la nómina histórica. Verifica que el contrato aprobado corresponda a la puesta en marcha y que no exista otro cambio en curso.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async closeRoster(): Promise<void> {
    const tripId = this.tripId();
    if (
      !tripId ||
      this.rosterClosed() ||
      !this.closureReviewed() ||
      this.closureReason.invalid ||
      this.busy()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.api.closeRoster(tripId, tripId, this.closureReason.getRawValue().trim()),
      );
      await this.refreshRoster(tripId);
      this.form.disable();
    } catch {
      this.error.set(
        'No se confirmó el cierre. Reintenta con el mismo motivo; no se cerrarán los pagos ni las devoluciones.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private async initialize(annexId: string): Promise<void> {
    const tripId = this.tripId();
    this.loading.set(true);
    this.error.set('');
    this.migrationRequired.set(false);
    try {
      await this.refreshRoster(tripId);
      if (annexId) {
        const state = await firstValueFrom(this.api.get(tripId, annexId));
        if (this.tripId() !== tripId) return;
        this.state.set(state);
        if (state.approvalReason) this.approvalReason.setValue(state.approvalReason);
        if (state.status === 'DRAFT') {
          this.impact.set(await firstValueFrom(this.api.impact(tripId, annexId)));
        }
        this.form.disable();
      }
    } catch (error: unknown) {
      if (this.tripId() === tripId) {
        if (error instanceof HttpErrorResponse && error.status === 409 && !annexId) {
          this.migrationRequired.set(true);
        } else {
          this.error.set('No se pudo cargar la nómina vigente o el anexo solicitado.');
        }
      }
    } finally {
      if (this.tripId() === tripId) this.loading.set(false);
    }
  }

  private async refreshRoster(tripId: string): Promise<void> {
    const members: RosterMember[] = [];
    let cursor = '';
    let firstPage = true;
    do {
      const page = await firstValueFrom(this.api.roster(tripId, cursor));
      if (firstPage) {
        this.rosterClosed.set(page.closed ?? false);
        this.rosterClosedAt.set(page.closedAt ?? '');
        this.rosterCloseReason.set(page.closeReason ?? '');
        firstPage = false;
      }
      members.push(...page.items);
      cursor = page.nextCursor ?? '';
    } while (cursor);
    this.roster.set(members);
    if (this.rosterClosed()) this.form.disable();
  }

  private buildRequest(): AnnexDraftRequest | null {
    if (this.form.invalid || this.form.controls.reason.getRawValue().trim().length < 5) return null;
    const admissions = [] as AnnexDraftRequest['admissions'];
    const replacements = [] as AnnexDraftRequest['replacements'];
    const withdrawalIds = new Set(this.selectedWithdrawals());
    const replaced = new Set<string>();
    for (const group of this.form.controls.admissions.controls) {
      const value = group.getRawValue();
      const accountId = newUlid();
      if (value.replacesAccountId) {
        if (replaced.has(value.replacesAccountId)) return null;
        replaced.add(value.replacesAccountId);
        withdrawalIds.add(value.replacesAccountId);
        replacements.push({
          outgoingAccountId: value.replacesAccountId,
          incomingAccountId: accountId,
        });
      }
      const installments = value.free
        ? []
        : buildAnnexInstallments(
            value.firstDueDate,
            value.installmentQuantity,
            value.installmentAmount,
          );
      if (
        !value.name.trim() ||
        !value.dni.trim() ||
        (value.free && value.depositAgreed !== 0) ||
        (!value.free && installments.length !== value.installmentQuantity)
      ) {
        return null;
      }
      admissions.push({
        accountId,
        participantId: accountId,
        name: value.name.trim(),
        dni: value.dni.trim(),
        free: value.free,
        depositAgreed: value.free ? 0 : value.depositAgreed,
        installments,
      });
    }
    const byId = new Map(this.activeRoster().map((member) => [member.accountId, member]));
    const withdrawals = [...withdrawalIds].map((accountId) => ({
      accountId,
      expectedVersion: byId.get(accountId)?.version ?? 0,
    }));
    if (
      (!admissions.length && !withdrawals.length) ||
      withdrawals.some(({ expectedVersion }) => expectedVersion < 1)
    )
      return null;
    return {
      id: newUlid(),
      reason: this.form.controls.reason.getRawValue().trim(),
      withdrawals,
      admissions,
      replacements,
    };
  }
}

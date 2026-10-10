import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { Panel } from 'primeng/panel';
import { Textarea } from 'primeng/textarea';
import { newUlid } from '../../../../shared/fn/new-ulid';
import type { RosterMember } from '../../interfaces/collection-annex.interface';
import type {
  GroupDiscountApprovalRequest,
  GroupDiscountDraftRequest,
  GroupDiscountState,
} from '../../interfaces/group-discount.interface';
import { CollectionAnnexes } from '../../services/collection-annexes';
import { CollectionGroupDiscounts } from '../../services/collection-group-discounts';

@Component({
  selector: 'app-group-discount',
  imports: [
    CurrencyPipe,
    RouterLink,
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    InputNumber,
    Message,
    MultiSelect,
    Panel,
    Textarea,
  ],
  templateUrl: './group-discount.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDiscountPage {
  private readonly api = inject(CollectionGroupDiscounts);
  private readonly rosterApi = inject(CollectionAnnexes);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tripId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly discountId = signal(this.route.snapshot.queryParamMap.get('descuento') ?? '');
  protected readonly members = signal<RosterMember[]>([]);
  protected readonly state = signal<GroupDiscountState | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private draftRequest: GroupDiscountDraftRequest | null = null;
  private approvalRequest: GroupDiscountApprovalRequest | null = null;
  protected readonly payerOptions = computed(() =>
    this.members()
      .filter((m) => m.active && !m.free)
      .map((m) => ({ ...m, label: `${m.name} · ${m.document}` })),
  );
  protected readonly draftForm = new FormGroup({
    all: new FormControl(true, { nonNullable: true }),
    accountIds: new FormControl<string[]>([], { nonNullable: true }),
    percentage: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01), Validators.max(100)],
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    reviewed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
  protected readonly approvalForm = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    reviewed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
  constructor() {
    if (!this.tripId) {
      this.error.set('No se identificó la gira.');
      return;
    }
    if (this.discountId()) this.recover();
    else this.loadRoster('');
  }
  private loadRoster(cursor: string): void {
    this.busy.set(true);
    this.rosterApi
      .roster(this.tripId, cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.members.update((v) => [...v, ...page.items]);
          if (page.nextCursor) this.loadRoster(page.nextCursor);
          else this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('No se pudo cargar la nómina vigente.');
        },
      });
  }
  protected create(): void {
    if (this.busy() || this.state()) return;
    this.error.set('');
    if (!this.draftRequest) {
      this.draftForm.markAllAsTouched();
      const v = this.draftForm.getRawValue();
      if (this.draftForm.invalid || (!v.all && !v.accountIds.length)) {
        this.error.set('Selecciona los beneficiarios, el porcentaje y confirma la revisión.');
        return;
      }
      const id = this.discountId() || newUlid();
      this.discountId.set(id);
      this.draftRequest = {
        id,
        accountIds: v.all ? [] : [...v.accountIds],
        basisPoints: Math.round(v.percentage * 100),
        reason: v.reason.trim(),
      };
      this.draftForm.disable();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { descuento: id },
        replaceUrl: true,
      });
    }
    this.busy.set(true);
    this.api
      .create(this.tripId, this.draftRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this.accept(s),
        error: () => {
          this.busy.set(false);
          this.error.set('No se confirmó el borrador. Reintenta exactamente la misma solicitud.');
        },
      });
  }
  protected approve(): void {
    const current = this.state();
    if (this.busy() || !current || current.status !== 'DRAFT') return;
    this.error.set('');
    if (!this.approvalRequest) {
      this.approvalForm.markAllAsTouched();
      const v = this.approvalForm.getRawValue();
      if (this.approvalForm.invalid) {
        this.error.set('Debes revisar el impacto y confirmar la aprobación.');
        return;
      }
      this.approvalRequest = { commandId: newUlid(), reason: v.reason.trim() };
      this.approvalForm.disable();
    }
    this.busy.set(true);
    this.api
      .approve(this.tripId, this.discountId(), this.approvalRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this.accept(s),
        error: () => {
          this.busy.set(false);
          this.error.set(
            'No se confirmó la aprobación. Reintenta la misma operación; si fue rechazada, alguna cuenta cambió o mantiene un cobro abierto.',
          );
        },
      });
  }
  protected recover(): void {
    if (this.busy() || !this.discountId()) return;
    this.busy.set(true);
    this.api
      .get(this.tripId, this.discountId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => this.accept(s),
        error: () => {
          this.busy.set(false);
          this.error.set(
            'No se encontró el descuento. Reintenta el borrador con los mismos datos.',
          );
        },
      });
  }
  private accept(s: GroupDiscountState): void {
    this.state.set(s);
    this.busy.set(false);
    if (s.status === 'DRAFT') this.draftForm.disable();
  }
}

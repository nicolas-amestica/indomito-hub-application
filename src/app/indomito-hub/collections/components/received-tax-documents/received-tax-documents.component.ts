import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tooltip } from 'primeng/tooltip';
import {
  catchError,
  EMPTY,
  exhaustMap,
  finalize,
  of,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  tap,
  timer,
  timeout,
} from 'rxjs';
import { newUlid } from '../../../../shared/fn/new-ulid';
import { localDateToDateOnly } from '../../../../shared/date-only/date-only';
import { RECEIVED_TAX_ACTIONS } from '../../constants/received-tax-actions.constant';
import { RECEIVED_TAX_DESIGN_TOKENS } from '../../constants/received-tax-design-tokens.constant';
import { RECEIVED_TAX_SYNC_STATUS } from '../../constants/received-tax-sync-status.constant';
import type {
  ReceivedTaxDocument,
  ReceivedTaxPage,
  ReceivedTaxResult,
  ReceivedSyncRequest,
} from '../../interfaces/received-tax-document.interface';
import { ReceivedTaxDocuments } from '../../services/received-tax-documents';
import { receivedTaxRestriction } from '../../fn/received-tax-restriction';

@Component({
  selector: 'app-received-tax-documents',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    Dialog,
    DatePicker,
    InputText,
    Message,
    Panel,
    Select,
    TableModule,
    Tooltip,
  ],
  templateUrl: './received-tax-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivedTaxDocumentsComponent {
  protected readonly designTokens = RECEIVED_TAX_DESIGN_TOKENS;
  private readonly api = inject(ReceivedTaxDocuments);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly month = signal(new Date().toLocaleDateString('sv-SE').slice(0, 7));
  protected readonly filters = new FormGroup({
    month: new FormControl(new Date(), { nonNullable: true }),
  });
  protected readonly decision = new FormGroup({
    action: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S[\s\S]{3}\S/),
        Validators.maxLength(500),
      ],
    }),
    confirmed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
  private readonly requests = new Subject<{ month: string; cursor: string; more: boolean }>();
  protected readonly loadedMonth = signal('');
  protected readonly items = signal<ReceivedTaxDocument[]>([]);
  protected readonly issues = signal<ReceivedTaxPage['issues']>([]);
  protected readonly nextCursor = signal('');
  protected readonly lastSuccess = signal('');
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly syncing = signal(false);
  protected readonly manualSync = signal<ReceivedSyncRequest | null>(null);
  protected readonly syncStatuses = RECEIVED_TAX_SYNC_STATUS;
  protected readonly noticeSeverity = computed(() =>
    this.manualSync()?.status === 'FAILED' ? 'warn' : 'info',
  );
  private lastTrackedRequestID = '';
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly selected = signal<ReceivedTaxDocument | null>(null);
  protected readonly result = signal<ReceivedTaxResult | null>(null);
  protected readonly restriction = computed(() =>
    receivedTaxRestriction(this.selected(), this.result()),
  );
  protected readonly actions = [...RECEIVED_TAX_ACTIONS];

  constructor() {
    this.requests
      .pipe(
        switchMap(({ month, cursor, more }) => {
          this.loading.set(true);
          this.error.set('');
          return this.api.list(month, cursor).pipe(
            tap((page) => this.applyPage(page, month, more)),
            catchError(() => {
              this.error.set('No fue posible consultar los documentos recibidos.');
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.filters.controls.month.valueChanges
      .pipe(startWith(this.filters.controls.month.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || Number.isNaN(value.getTime())) return;
        this.month.set(localDateToDateOnly(value).slice(0, 7));
        this.load();
      });
    this.decision.controls.action.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.decision.controls.confirmed.setValue(false));
  }

  protected load(more = false): void {
    const month = more ? this.loadedMonth() : this.month();
    if (more && (this.loading() || this.syncing() || month !== this.month())) return;
    if (!more) {
      this.items.set([]);
      this.nextCursor.set('');
    }
    this.requests.next({ month, cursor: more ? this.nextCursor() : '', more });
  }

  private applyPage(page: ReceivedTaxPage, month: string, more = false): void {
    this.lastSuccess.set(page.sync.lastSuccess);
    this.issues.set(page.issues);
    if (page.manualSync && !this.syncing()) {
      this.manualSync.set(page.manualSync);
      if (
        (page.manualSync.status === 'PENDING' || page.manualSync.status === 'RUNNING') &&
        this.lastTrackedRequestID !== page.manualSync.id
      )
        this.followSyncRequest(page.manualSync);
    }
    if (month !== this.month()) return;
    this.items.set(more ? [...this.items(), ...page.items] : page.items);
    this.nextCursor.set(page.nextCursor);
    this.loadedMonth.set(month);
  }

  protected synchronize(): void {
    if (this.syncing() || this.busy()) return;
    this.syncing.set(true);
    this.error.set('');
    this.notice.set('Solicitando lectura del correo…');
    this.manualSync.set(null);
    this.api
      .synchronize()
      .pipe(timeout(15000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ request }) => {
          if (request) this.followSyncRequest(request);
          else {
            this.syncing.set(false);
            this.notice.set(
              'Ya se solicitó una lectura reciente. Actualiza el listado antes de volver a sincronizar.',
            );
            this.load();
          }
        },
        error: () => {
          this.syncing.set(false);
          this.notice.set('');
          this.error.set(
            'No fue posible confirmar la sincronización. Revisa la última lectura antes de volver a intentarlo.',
          );
        },
      });
  }

  private followSyncRequest(initial: ReceivedSyncRequest): void {
    this.lastTrackedRequestID = initial.id;
    this.manualSync.set(initial);
    this.syncing.set(true);
    this.notice.set(
      initial.detail || `Sincronización ${this.syncStatuses[initial.status].toLowerCase()}.`,
    );
    const active = (job: ReceivedSyncRequest) =>
      job.status === 'PENDING' || job.status === 'RUNNING';
    const status = active(initial)
      ? timer(0, 5000).pipe(
          take(72),
          exhaustMap(() => this.api.syncStatus(initial.id).pipe(timeout(15000))),
        )
      : of(initial);
    status
      .pipe(
        tap((job) => {
          this.manualSync.set(job);
          this.notice.set(
            job.detail || `Sincronización ${this.syncStatuses[job.status].toLowerCase()}.`,
          );
        }),
        takeWhile(active, true),
        takeUntil(timer(360000)),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.syncing.set(false)),
      )
      .subscribe({
        complete: () => {
          if (this.destroyRef.destroyed) return;
          if (active(this.manualSync()!))
            this.notice.set(
              'La solicitud sigue pendiente o en ejecución. Puedes volver a abrir esta pantalla para retomar su seguimiento.',
            );
          this.load();
        },
        error: () => {
          this.notice.set(
            'No fue posible consultar el estado de esta solicitud. Su resultado sigue guardado; vuelve a abrir la pantalla para consultarlo.',
          );
        },
      });
  }

  protected open(document: ReceivedTaxDocument): void {
    if (this.busy()) return;
    this.selected.set(document);
    this.result.set(null);
    this.decision.reset();
    this.query();
  }

  protected query(register = false): void {
    const document = this.selected();
    if (!document || this.busy()) return;
    if (register) {
      if (this.restriction()) return;
      this.decision.markAllAsTouched();
      if (this.decision.invalid || this.decision.controls.reason.value.trim().length < 5) return;
    }
    const { action, reason } = this.decision.getRawValue();
    this.busy.set(true);
    this.decision.disable({ emitEvent: false });
    this.error.set('');
    this.api
      .events(
        document.id,
        document.issueDate.slice(0, 7),
        register ? action : '',
        register ? newUlid() : '',
        reason.trim(),
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.busy.set(false);
          this.decision.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (response) => {
          this.result.set(response.result);
          this.decision.controls.confirmed.setValue(false);
          if (!register) this.selected.set(response.document);
          else {
            this.decision.reset();
          }
        },
        error: () =>
          this.error.set(
            'No fue posible completar la operación. Consulta los eventos del SII antes de volver a enviar una decisión.',
          ),
      });
  }

  protected download(document: ReceivedTaxDocument): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .download(document.id, document.issueDate.slice(0, 7))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: ({ url }) => {
          const link = window.document.createElement('a');
          link.href = url;
          link.rel = 'noopener';
          link.click();
        },
        error: () => this.error.set('No fue posible descargar el XML.'),
      });
  }
}

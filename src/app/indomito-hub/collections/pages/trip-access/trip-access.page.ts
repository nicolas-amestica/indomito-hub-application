import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { newUlid } from '../../../../shared/fn/new-ulid';
import type { TripAccessRequest, TripAccessView } from '../../interfaces/trip-access.interface';
import { CollectionTripAccess } from '../../services/collection-trip-access';

@Component({
  selector: 'app-trip-access',
  imports: [ReactiveFormsModule, RouterLink, ButtonDirective, Checkbox, Message, Panel, Textarea],
  templateUrl: './trip-access.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripAccessPage {
  private readonly api = inject(CollectionTripAccess);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tripId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly access = signal<TripAccessView | null>(null);
  protected readonly busy = signal(false);
  protected readonly copying = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  private pending: { action: 'rotate' | 'revoke'; request: TripAccessRequest } | null = null;
  protected readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)],
    }),
    reviewed: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
  constructor() {
    if (this.tripId) this.load();
    else this.error.set('No se identificó la gira.');
  }
  protected async copyCode(): Promise<void> {
    const code = this.access()?.tripCode;
    if (!code || this.copying()) return;
    this.copying.set(true);
    try {
      await navigator.clipboard.writeText(code);
      this.success.set('Código copiado. Compártelo solo con las personas autorizadas del grupo.');
    } catch {
      this.error.set(
        'No fue posible copiar automáticamente. Selecciona el código y cópialo manualmente.',
      );
    } finally {
      this.copying.set(false);
    }
  }
  protected change(action: 'rotate' | 'revoke'): void {
    const current = this.access();
    if (!current || this.busy()) return;
    this.error.set('');
    this.success.set('');
    if (!this.pending) {
      this.form.markAllAsTouched();
      const value = this.form.getRawValue();
      if (this.form.invalid) {
        this.error.set('Debes indicar el motivo y confirmar el impacto sobre el acceso.');
        return;
      }
      this.pending = {
        action,
        request: { commandId: newUlid(), reason: value.reason.trim(), version: current.version },
      };
      this.form.disable();
    }
    if (this.pending.action !== action) {
      this.error.set('Hay otra operación pendiente. Recarga antes de continuar.');
      return;
    }
    this.busy.set(true);
    this.api
      .change(this.tripId, action, this.pending.request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (view) => {
          this.access.set(view);
          this.pending = null;
          this.form.reset();
          this.form.enable();
          this.success.set(
            action === 'rotate'
              ? 'Código rotado. Comunica únicamente el nuevo código.'
              : 'Acceso revocado. Las sesiones y el código vigente dejaron de ser válidos.',
          );
        },
        error: () =>
          this.error.set(
            'No se confirmó el resultado. Recarga la página para consultar el estado durable o reintenta la misma operación.',
          ),
      });
  }
  private load(): void {
    this.busy.set(true);
    this.api
      .get(this.tripId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (view) => this.access.set(view),
        error: () => this.error.set('No fue posible cargar el acceso de esta gira.'),
      });
  }
}

import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { AppConfigurationService } from '../../../../../core/configuration/app-configuration.service';
import { MasterAccessService } from '../../services/master-access.service';
import type { MasterAccess } from '../../interfaces/master-access.interface';

@Component({
  selector: 'app-configuration',
  imports: [FormsModule, ButtonDirective, InputText, Message],
  templateUrl: './configuration.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigurationPage {
  readonly configuration = inject(AppConfigurationService);
  readonly saving = signal(false);
  readonly saved = signal(false);
  private readonly masterApi = inject(MasterAccessService);
  private readonly destroyRef = inject(DestroyRef);
  readonly masterAccess = signal<MasterAccess | null>(null);
  readonly masterBusy = signal(false);
  readonly masterError = signal('');
  readonly revealedCode = signal('');
  readonly form = {
    vatRate: this.configuration.taxes().vatRate,
    crewWithholdingRate: this.configuration.taxes().crewWithholdingRate,
  };

  constructor() {
    effect(() => Object.assign(this.form, this.configuration.taxes()));
    this.loadMasterAccess();
  }

  loadMasterAccess(): void {
    this.masterBusy.set(true);
    this.masterError.set('');
    this.masterApi
      .get()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.masterBusy.set(false)),
      )
      .subscribe({
        next: (value) => this.masterAccess.set(value),
        error: () => this.masterError.set('No fue posible consultar el acceso maestro.'),
      });
  }

  rotateMasterAccess(): void {
    if (this.masterBusy()) return;
    this.masterBusy.set(true);
    this.masterError.set('');
    this.revealedCode.set('');
    this.masterApi
      .rotate()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.masterBusy.set(false)),
      )
      .subscribe({
        next: (value) => {
          this.masterAccess.set(value);
          this.revealedCode.set(value.code ?? '');
        },
        error: () => this.masterError.set('No fue posible crear o rotar el acceso maestro.'),
      });
  }

  revokeMasterAccess(): void {
    if (this.masterBusy()) return;
    this.masterBusy.set(true);
    this.masterError.set('');
    this.revealedCode.set('');
    this.masterApi
      .revoke()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.masterBusy.set(false)),
      )
      .subscribe({
        next: (value) => this.masterAccess.set(value),
        error: () => this.masterError.set('No fue posible revocar el acceso maestro.'),
      });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    try {
      await this.configuration.save(this.form);
      this.saved.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}

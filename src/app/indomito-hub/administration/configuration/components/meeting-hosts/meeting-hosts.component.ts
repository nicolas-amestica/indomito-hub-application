import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ColorPicker } from 'primeng/colorpicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import type { MeetingHost, MeetingHostRequest } from '../../../../../core/configuration/meeting-host.interface';
import { MeetingHostService } from '../../../../../core/configuration/meeting-host.service';

@Component({
  selector: 'app-meeting-hosts',
  imports: [ReactiveFormsModule, Button, Checkbox, ColorPicker, Dialog, InputText, Message, TableModule, Textarea],
  templateUrl: './meeting-hosts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingHostsComponent {
  private readonly api = inject(MeetingHostService);
  private readonly destroyRef = inject(DestroyRef);
  readonly hosts = signal<MeetingHost[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly dialogVisible = signal(false);
  readonly selected = signal<MeetingHost | null>(null);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    color: new FormControl('#2563EB', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^#?[0-9A-Fa-f]{6}$/)] }),
    active: new FormControl(true, { nonNullable: true }),
    isDefault: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: hosts => this.hosts.set(hosts),
      error: () => this.error.set('No fue posible consultar los anfitriones.'),
    });
  }

  open(host?: MeetingHost): void {
    this.selected.set(host ?? null);
    this.form.reset(host ? {
      name: host.name,
      description: host.description,
      color: host.color,
      active: host.active,
      isDefault: host.isDefault,
    } : {
      name: '', description: '', color: '#2563EB', active: true, isDefault: false,
    });
    this.dialogVisible.set(true);
  }

  onDefaultChange(checked: boolean): void {
    if (checked) this.form.controls.active.setValue(true);
  }

  onActiveChange(checked: boolean): void {
    if (!checked) this.form.controls.isDefault.setValue(false);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const raw = this.form.getRawValue();
    const request: MeetingHostRequest = {
      ...raw,
      color: `#${raw.color.replace(/^#/, '').toUpperCase()}`,
    };
    const current = this.selected();
    const operation = current ? this.api.update(current.id, request) : this.api.create(request);
    operation.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.dialogVisible.set(false);
        this.load();
      },
      error: () => this.error.set('No fue posible guardar el anfitrión.'),
    });
  }

  remove(host: MeetingHost): void {
    if (this.saving() || !window.confirm(`¿Eliminar al anfitrión ${host.name}?`)) return;
    this.saving.set(true);
    this.error.set('');
    this.api.remove(host.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => this.load(),
      error: () => this.error.set('No fue posible eliminar el anfitrión.'),
    });
  }
}

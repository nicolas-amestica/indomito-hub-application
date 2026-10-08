import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { finalize } from 'rxjs';

import { NotificationService } from '../../../../../core/notifications/notification.service';
import type {
  ServiceCatalogInput,
  ServiceCatalogItem,
} from '../../../../../shared/service-catalog/interfaces/service-catalog.interface';
import { ServiceCatalogApiService } from '../../../../../shared/service-catalog/services/service-catalog-api.service';

const CURRENCIES = ['CLP', 'USD', 'BRL'] as const;
const CHARGE_TYPES = [
  { value: 'fixed', label: 'Fijo' },
  { value: 'per_passenger', label: 'Por pasajero' },
  { value: 'per_passenger_night', label: 'Por pasajero y noche' },
  { value: 'per_day', label: 'Por día' },
  { value: 'per_passenger_day', label: 'Por pasajero y día' },
] as const;

@Component({
  selector: 'app-service-catalog-page',
  imports: [
    ButtonDirective,
    DecimalPipe,
    InputNumber,
    InputText,
    ReactiveFormsModule,
    Select,
    TableModule,
    ToggleSwitch,
  ],
  templateUrl: './service-catalog.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCatalogPage {
  private readonly api = inject(ServiceCatalogApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);

  protected readonly items = signal<ServiceCatalogItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly currencies = [...CURRENCIES];
  protected readonly chargeTypes = [...CHARGE_TYPES];
  protected readonly form = new FormGroup({
    glosa: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(300)],
    }),
    price: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(99_999_999),
    ]),
    currency: new FormControl<'CLP' | 'USD' | 'BRL'>('CLP', {
      nonNullable: true,
      validators: Validators.required,
    }),
    chargeType: new FormControl<ServiceCatalogInput['chargeType']>('fixed', {
      nonNullable: true,
      validators: Validators.required,
    }),
    active: new FormControl(true, { nonNullable: true }),
    default: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  protected edit(item: ServiceCatalogItem): void {
    this.editingId.set(item.id);
    this.form.setValue({
      glosa: item.glosa,
      description: item.description ?? '',
      price: item.price,
      currency: item.currency,
      chargeType: item.chargeType,
      active: item.active,
      default: item.default,
    });
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.form.reset({
      glosa: '',
      description: '',
      price: null,
      currency: 'CLP',
      chargeType: 'fixed',
      active: true,
      default: false,
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: ServiceCatalogInput = { ...value, price: value.price! };
    const id = this.editingId();
    const request = id === null ? this.api.create(input) : this.api.update(id, input);
    this.saving.set(true);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.notifications.success(
            id === null ? 'Servicio creado correctamente.' : 'Servicio actualizado correctamente.',
          );
          this.cancel();
          this.load();
        },
        error: () => this.notifications.error('No fue posible guardar el servicio.'),
      });
  }

  protected chargeTypeLabel(value: string): string {
    return this.chargeTypes.find((option) => option.value === value)?.label ?? value;
  }

  private load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api
      .list(true)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (items) => this.items.set(items),
        error: () => this.notifications.error('No fue posible cargar el catálogo de servicios.'),
      });
  }
}

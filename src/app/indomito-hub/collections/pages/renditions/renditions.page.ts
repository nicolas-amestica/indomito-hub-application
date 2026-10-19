import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Panel } from 'primeng/panel';
import { finalize } from 'rxjs';
import { RENDITION_LABELS } from '../../constants/rendition-labels.constant';
import type {
  CollectionRendition,
  CollectionRenditionItem,
} from '../../interfaces/collection-rendition.interface';
import { CollectionRenditions } from '../../services/collection-renditions';

@Component({
  selector: 'app-renditions',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    InputText,
    Message,
    Panel,
  ],
  templateUrl: './renditions.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenditionsPage {
  private readonly api = inject(CollectionRenditions);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly labels = RENDITION_LABELS;
  protected readonly month = new FormControl(new Date().toISOString().slice(0, 7), {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly reports = signal<CollectionRendition[]>([]);
  protected readonly selected = signal<CollectionRendition | null>(null);
  protected readonly items = signal<CollectionRenditionItem[]>([]);
  protected readonly next = signal('');
  protected readonly detailNext = signal('');
  private loadedMonth = this.month.value;

  constructor() {
    this.load();
  }

  protected load(more = false): void {
    if (this.busy()) return;
    this.month.markAsTouched();
    if (!more && this.month.invalid) return;
    if (!more) {
      this.loadedMonth = this.month.value;
      this.reports.set([]);
      this.next.set('');
      this.selected.set(null);
      this.items.set([]);
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .list(this.loadedMonth, more ? this.next() : '')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (page) => {
          this.reports.update((rows) => (more ? [...rows, ...page.items] : page.items));
          this.next.set(page.nextCursor ?? '');
        },
        error: () =>
          this.error.set(
            'No fue posible consultar las rendiciones. Revisa la configuración del servicio e intenta nuevamente.',
          ),
      });
  }

  protected detail(report: CollectionRendition, more = false): void {
    if (this.busy()) return;
    if (!more) {
      this.selected.set(report);
      this.items.set([]);
      this.detailNext.set('');
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .detail(report.id, more ? this.detailNext() : '')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (page) => {
          this.items.update((rows) => (more ? [...rows, ...page.items] : page.items));
          this.detailNext.set(page.nextCursor ?? '');
          if (page.rendition) this.selected.set(page.rendition);
        },
        error: () =>
          this.error.set('No fue posible cargar el detalle. Puedes volver a intentarlo.'),
      });
  }
}

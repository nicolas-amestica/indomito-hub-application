import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { MeetService, type MeetEvent, type MeetRequest } from './meet.service';

interface DayCell { date: string; number: number; current: boolean; events: MeetEvent[] }

@Component({
  selector: 'app-meet-calendar',
  standalone: true,
  imports: [FormsModule, Button, Dialog, InputText, Message, Skeleton],
  templateUrl: './meet-calendar.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetCalendarPage {
  private readonly api = inject(MeetService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = new Date();
  readonly year = signal(this.now.getFullYear());
  readonly month = signal(this.now.getMonth());
  readonly events = signal<MeetEvent[]>([]);
  readonly loading = signal(false);
  private requestSequence = 0;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly dialogVisible = signal(false);
  readonly selected = signal<MeetEvent | null>(null);
  readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly placeholders = Array.from({ length: 35 }, (_, i) => i);
  readonly form: MeetRequest = this.emptyForm();
  readonly guestsText = signal('');
  readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' })
      .format(new Date(this.year(), this.month(), 1)),
  );
  readonly days = computed<DayCell[]>(() => {
    const y = this.year(), m = this.month();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const length = Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7) * 7;
    const events = this.events();
    return Array.from({ length }, (_, index) => {
      const date = new Date(y, m, index - offset + 1);
      const key = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      return { date: key, number: date.getDate(), current: date.getMonth() === m, events: events.filter(e => e.date === key) };
    });
  });

  constructor() { this.refresh(); }

  private emptyForm(): MeetRequest {
    return { title: '', date: '', startTime: '10:00', description: '', guests: [], hostSk: null, hostName: null, hostColor: null };
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set('');
    const requestId = ++this.requestSequence;
    this.api.list(this.year(), this.month() + 1).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (requestId === this.requestSequence) this.loading.set(false); }),
    ).subscribe({
      next: data => { if (requestId === this.requestSequence) this.events.set(data); },
      error: () => { if (requestId === this.requestSequence) this.error.set('No fue posible consultar Google Calendar. Comprueba la integración del backend.'); },
    });
  }

  navigate(delta: number): void {
    const date = new Date(this.year(), this.month() + delta, 1);
    this.year.set(date.getFullYear());
    this.month.set(date.getMonth());
    this.refresh();
  }

  today(): void {
    this.year.set(this.now.getFullYear());
    this.month.set(this.now.getMonth());
    this.refresh();
  }

  open(date?: string, event?: MeetEvent): void {
    this.selected.set(event ?? null);
    Object.assign(this.form, this.emptyForm(), event ? {
      title: event.title, date: event.date, startTime: event.startTime,
      description: event.description, guests: [...event.guests],
      hostSk: event.hostSk, hostName: event.hostName, hostColor: event.hostColor,
    } : { date: date ?? '' });
    this.guestsText.set(this.form.guests.join(', '));
    this.dialogVisible.set(true);
  }

  save(): void {
    if (this.saving() || !this.form.title.trim() || !this.form.date || !this.form.startTime) return;
    this.form.guests = [...new Set(this.guestsText().split(/[;,\n]/).map(x => x.trim()).filter(Boolean))];
    this.saving.set(true);
    this.error.set('');
    const request = { ...this.form };
    const current = this.selected();
    const operation = current ? this.api.update(current.id, request) : this.api.create(request);
    operation.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.dialogVisible.set(false); this.refresh(); },
        error: () => this.error.set('No fue posible guardar la reunión en Google Calendar.'),
      });
  }

  remove(): void {
    const current = this.selected();
    if (!current || this.saving() || !window.confirm('¿Eliminar esta reunión de Google Calendar?')) return;
    this.saving.set(true);
    this.api.remove(current.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => { this.dialogVisible.set(false); this.refresh(); },
        error: () => this.error.set('No fue posible eliminar la reunión.'),
      });
  }
}

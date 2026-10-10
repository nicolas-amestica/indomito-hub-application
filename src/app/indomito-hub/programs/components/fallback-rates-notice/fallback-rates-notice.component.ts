import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { dateOnlyToLocalDate } from '../../../../shared/date-only/date-only';

/** Advertencia presentacional y reutilizable para un snapshot de respaldo. */
@Component({
  selector: 'app-fallback-rates-notice',
  imports: [DatePipe],
  templateUrl: './fallback-rates-notice.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FallbackRatesNoticeComponent {
  readonly date = input.required<string>();
  protected readonly localDate = computed(() => dateOnlyToLocalDate(this.date()));
}

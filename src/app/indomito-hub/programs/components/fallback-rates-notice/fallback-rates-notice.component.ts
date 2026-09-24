import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Advertencia presentacional y reutilizable para un snapshot de respaldo. */
@Component({
  selector: 'app-fallback-rates-notice',
  imports: [DatePipe],
  templateUrl: './fallback-rates-notice.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FallbackRatesNoticeComponent {
  readonly date = input.required<string>();
}

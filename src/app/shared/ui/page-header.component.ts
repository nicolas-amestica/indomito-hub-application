import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Encabezado de referencia para formularios y páginas de gestión. */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly eyebrow = input('Gestión de viajes');
}

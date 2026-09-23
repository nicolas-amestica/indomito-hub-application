import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

/** Encabezado de referencia para formularios y páginas de gestión. */
@Component({
  selector: 'app-page-header',
  imports: [NgOptimizedImage],
  templateUrl: './page-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly eyebrow = input('Gestión de viajes');
}

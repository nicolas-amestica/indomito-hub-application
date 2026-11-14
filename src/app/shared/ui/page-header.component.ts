import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Cabecera institucional con acciones proyectadas y contraste estable en ambos temas. */
@Component({
  selector: 'app-page-header',
  host: { class: 'block min-w-0' },
  templateUrl: './page-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly context = input('');
  readonly description = input('');
}

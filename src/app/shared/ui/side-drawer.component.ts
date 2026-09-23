import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { ButtonDirective } from 'primeng/button';

import { fadeOverlayMotion, slidePanelMotion } from '../animations/ui-motion.animations';
import { MotionPressDirective } from './motion-press.directive';

/** Armazón reutilizable para paneles laterales; el contenido pertenece a cada feature. */
@Component({
  selector: 'app-side-drawer',
  imports: [ButtonDirective, MotionPressDirective],
  templateUrl: './side-drawer.component.html',
  animations: [fadeOverlayMotion, slidePanelMotion],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideDrawerComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly eyebrow = input('');
  readonly ariaLabel = input('Panel lateral');
  readonly closeAriaLabel = input('Cerrar panel lateral');
  readonly loading = input(false);
  readonly collapsible = input(true);

  readonly visible = model(false);
  readonly collapsed = model(false);

  protected readonly panelClasses = computed(() =>
    this.collapsed()
      ? 'fixed inset-y-0 right-0 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden border-l border-line bg-surface shadow-2xl md:w-20'
      : 'fixed inset-y-0 right-0 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden border-l border-line bg-surface shadow-2xl md:w-96',
  );
}

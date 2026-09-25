import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../theme/theme.service';
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Dialog, ButtonDirective, Tooltip],
  templateUrl: './app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly open = signal(false);
  readonly category = signal('Todos');
  readonly navigableModules = computed(() =>
    this.auth.modules().filter((module) => module.level !== 'LV1'),
  );
  readonly categories = computed(() => [
    'Todos',
    ...new Set(this.navigableModules().map((module) => module.category || 'General')),
  ]);
  readonly visibleModules = computed(() =>
    this.category() === 'Todos'
      ? this.navigableModules()
      : this.navigableModules().filter((module) => (module.category || 'General') === this.category()),
  );
  toggle() {
    this.open.update((v) => !v);
  }
}

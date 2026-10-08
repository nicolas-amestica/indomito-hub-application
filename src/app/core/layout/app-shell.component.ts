import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../theme/theme.service';
import { AppMegaMenuComponent } from './app-mega-menu/app-mega-menu.component';
@Component({
  selector: 'app-shell',
  imports: [AppMegaMenuComponent, ButtonDirective, RouterOutlet, RouterLink, Tooltip],
  templateUrl: './app-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly open = signal(false);
  readonly navigableModules = computed(() =>
    this.auth.modules().filter((module) => module.level !== 'LV1'),
  );
  toggle() {
    this.open.update((v) => !v);
  }
}

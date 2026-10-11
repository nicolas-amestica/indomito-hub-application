import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../theme/theme.service';
import { AppMegaMenuComponent } from './app-mega-menu/app-mega-menu.component';
import type { AuthModule } from '../auth/auth.models';

const HOME_MODULE: AuthModule = {
  code: 'HOME',
  title: 'Inicio',
  category: 'General',
  path: '/inicio',
  icon: 'icon-[tabler--layout-dashboard]',
  order: -1,
  active: true,
  endpoints: [],
  level: 'LV2',
};

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
  readonly navigableModules = computed(() => [
    HOME_MODULE,
    ...this.auth.modules().filter((module) => module.level !== 'LV1'),
  ]);
  toggle() {
    this.open.update((v) => !v);
  }
}

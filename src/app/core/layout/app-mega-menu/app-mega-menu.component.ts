import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { InputText } from 'primeng/inputtext';

import type { AuthModule } from '../../auth/auth.models';

const moduleIconFallbacks: Readonly<Record<string, string>> = {
  PAYMENT_SETUP: 'icon-[tabler--rocket]',
  PAYMENT_OPERATIONS: 'icon-[tabler--cash-register]',
};

@Component({
  selector: 'app-mega-menu',
  imports: [ButtonDirective, Drawer, InputText, RouterLink],
  templateUrl: './app-mega-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppMegaMenuComponent {
  readonly modules = input.required<readonly AuthModule[]>();
  readonly visible = model(false);
  protected readonly searchQuery = signal('');
  protected readonly selectedCategory = signal('Todos');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly categories = computed(() => [
    'Todos',
    ...new Set(this.modules().map((item) => item.category || 'General')),
  ]);
  protected readonly filteredModules = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('es-CL');
    const category = this.selectedCategory();
    return this.modules().filter((item) => {
      const inCategory = category === 'Todos' || (item.category || 'General') === category;
      const searchable = `${item.title} ${item.category || 'General'}`.toLocaleLowerCase('es-CL');
      return inCategory && (query === '' || searchable.includes(query));
    });
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      this.searchQuery.set('');
      this.selectedCategory.set('Todos');
      setTimeout(() => this.searchInput()?.nativeElement.focus(), 100);
    });
  }

  protected updateSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected moduleIcon(module: AuthModule): string {
    return moduleIconFallbacks[module.code] || module.icon || 'icon-[tabler--point]';
  }

  protected close(): void {
    this.visible.set(false);
  }
}

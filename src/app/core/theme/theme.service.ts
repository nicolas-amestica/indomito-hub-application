import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'indomito-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly isDark = signal(false);
  readonly icon = computed(() =>
    this.isDark() ? 'icon-[tabler--sun]' : 'icon-[tabler--moon]',
  );
  readonly label = computed(() =>
    this.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
  );

  constructor() {
    const view = this.document.defaultView;
    const saved = view?.localStorage.getItem(THEME_STORAGE_KEY);
    const dark = saved ? saved === 'dark' : Boolean(view?.matchMedia('(prefers-color-scheme: dark)').matches);
    this.apply(dark, false);
  }

  toggle(): void {
    this.apply(!this.isDark(), true);
  }

  private apply(dark: boolean, persist: boolean): void {
    this.isDark.set(dark);
    this.document.documentElement.classList.toggle('dark', dark);
    this.document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    if (persist) this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
  }
}

import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators, type AbstractControl } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ProgressSpinner } from 'primeng/progressspinner';

import type { Favorite, FavoriteScope } from '../../interfaces/favorite.interface';

/** Panel presentacional y reutilizable para explorar y operar favoritos de un scope. */
@Component({
  selector: 'app-favorites-panel',
  imports: [ButtonDirective, DatePipe, Dialog, InputText, ProgressSpinner, ReactiveFormsModule],
  templateUrl: './favorites-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPanelComponent {
  readonly scope = input.required<FavoriteScope>();
  readonly favorites = input.required<readonly Favorite[]>();
  readonly totalFavoriteCount = input(0);
  readonly selectedFavorite = input<Favorite | null>(null);
  readonly loading = input(false);
  readonly busy = input(false);
  readonly hasError = input(false);
  readonly searchTerm = input('');

  readonly visible = model(false);
  readonly saveDialogVisible = model(false);

  readonly retryRequested = output<void>();
  readonly searchChanged = output<string>();
  readonly favoriteSelected = output<Favorite>();
  readonly favoriteDeleted = output<Favorite>();
  readonly saveSubmitted = output<string>();

  protected readonly collapsed = signal(false);
  protected readonly previewFavorite = signal<Favorite | null>(null);
  protected readonly deleteCandidate = signal<Favorite | null>(null);
  protected readonly favoriteName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, trimmedRequired],
  });
  protected readonly panelClasses = computed(() =>
    this.collapsed()
      ? 'fixed inset-y-0 right-0 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col border-l border-slate-200 bg-white shadow-2xl md:w-20'
      : 'fixed inset-y-0 right-0 z-40 flex w-[min(24rem,calc(100vw-2rem))] flex-col border-l border-slate-200 bg-white shadow-2xl md:w-96',
  );

  protected prepareSaveName(): void {
    this.favoriteName.setValue(this.selectedFavorite()?.name ?? '');
    this.favoriteName.markAsPristine();
    this.favoriteName.markAsUntouched();
  }

  protected submitFavoriteName(): void {
    this.favoriteName.markAsTouched();
    if (this.favoriteName.invalid || this.busy()) return;
    this.saveSubmitted.emit(this.favoriteName.value.trim());
  }

  protected updateSearch(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }

  protected confirmDelete(): void {
    const favorite = this.deleteCandidate();
    if (favorite === null || this.busy()) return;
    this.deleteCandidate.set(null);
    this.favoriteDeleted.emit(favorite);
  }
}

function trimmedRequired(control: AbstractControl): { trimmedRequired: true } | null {
  return typeof control.value === 'string' && control.value.trim() === ''
    ? { trimmedRequired: true }
    : null;
}

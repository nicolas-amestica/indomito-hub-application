import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { InputText } from 'primeng/inputtext';
import { ProgressSpinner } from 'primeng/progressspinner';

import type { Favorite, FavoriteScope, FavoriteSummary } from '../../interfaces/favorite.interface';
import { exchangeRateOriginLabel } from '../../fn/fn-exchange-rate-source';
import { trimmedRequiredValidator } from '../../validators/trimmed-required.validator';

/** Panel presentacional y reutilizable para explorar y operar favoritos de un scope. */
@Component({
  selector: 'app-favorites-panel',
  imports: [ButtonDirective, Dialog, Drawer, InputText, ProgressSpinner, ReactiveFormsModule],
  templateUrl: './favorites-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPanelComponent {
  readonly scope = input.required<FavoriteScope>();
  readonly favorites = input.required<readonly FavoriteSummary[]>();
  readonly totalFavoriteCount = input(0);
  readonly selectedFavorite = input<Favorite | null>(null);
  readonly previewFavorite = input<Favorite | null>(null);
  readonly loading = input(false);
  readonly busy = input(false);
  readonly hasError = input(false);
  readonly searchTerm = input('');

  readonly visible = model(false);
  readonly saveDialogVisible = model(false);

  readonly retryRequested = output<void>();
  readonly searchChanged = output<string>();
  readonly favoriteSelected = output<FavoriteSummary>();
  readonly favoritePreviewRequested = output<FavoriteSummary>();
  readonly favoriteDeleted = output<FavoriteSummary>();
  readonly saveSubmitted = output<string>();

  protected readonly deleteCandidate = signal<FavoriteSummary | null>(null);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  readonly previewClosed = output<void>();
  protected readonly exchangeRateOriginLabel = exchangeRateOriginLabel;
  protected readonly favoriteName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, trimmedRequiredValidator],
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      setTimeout(() => this.searchInput()?.nativeElement.focus(), 100);
    });
  }

  protected close(): void {
    this.visible.set(false);
  }

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

import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, tap, type Observable } from 'rxjs';

import type {
  Favorite,
  FavoriteContent,
  FavoriteScope,
  FavoriteUpsertRequest,
} from '../interfaces/favorite.interface';
import { FavoritesService } from '../services/favorites.service';

/** Estado feature-scoped de la colección de favoritos del usuario. */
@Injectable()
export class FavoritesStore {
  private readonly service = inject(FavoritesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly favoriteState = signal<Favorite[]>([]);
  private readonly selectedState = signal<Favorite | null>(null);
  private readonly loadingState = signal(false);
  private readonly mutatingState = signal(false);
  private readonly errorState = signal<unknown | null>(null);

  readonly favorites = this.favoriteState.asReadonly();
  readonly selected = this.selectedState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly mutating = this.mutatingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasError = computed(() => this.errorState() !== null);
  readonly searchTerm = signal('');
  readonly visibleFavorites = computed(() =>
    filterFavorites(this.favoriteState(), this.searchTerm()),
  );

  /** Recarga los favoritos cada vez que el panel se abre. */
  load(scope: FavoriteScope): void {
    if (this.loadingState()) return;

    this.loadingState.set(true);
    this.errorState.set(null);
    this.service
      .list(scope)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (favorites) => this.favoriteState.set(favorites),
        error: (error: unknown) => this.errorState.set(error),
      });
  }

  /** Marca el favorito cuyo contenido está actualmente cargado en el formulario. */
  select(favorite: Favorite): void {
    this.selectedState.set(favorite);
  }

  /**
   * Crea o actualiza según el nombre del favorito seleccionado.
   * La comparación ignora mayúsculas y espacios repetidos o exteriores.
   */
  save(name: string, content: FavoriteContent): Observable<Favorite> {
    const request: FavoriteUpsertRequest = { name: name.trim(), content };
    const selected = this.selectedState();
    const operation =
      selected !== null && normalizeFavoriteName(selected.name) === normalizeFavoriteName(name)
        ? this.service.update(selected.id, request)
        : this.service.create(request);

    this.mutatingState.set(true);
    this.errorState.set(null);
    return operation.pipe(
      tap((favorite) => {
        this.favoriteState.update((favorites) => upsertFavorite(favorites, favorite));
        this.selectedState.set(favorite);
      }),
      finalize(() => this.mutatingState.set(false)),
    );
  }

  /** Elimina el favorito y limpia la selección si correspondía al formulario actual. */
  delete(favorite: Favorite): Observable<void> {
    this.mutatingState.set(true);
    this.errorState.set(null);
    return this.service.delete(favorite.id).pipe(
      tap(() => {
        this.favoriteState.update((favorites) =>
          favorites.filter((candidate) => candidate.id !== favorite.id),
        );
        if (this.selectedState()?.id === favorite.id) this.selectedState.set(null);
      }),
      finalize(() => this.mutatingState.set(false)),
    );
  }
}

/** Normaliza un nombre para decidir si guardar significa actualizar. */
export function normalizeFavoriteName(name: string): string {
  return name.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es-CL');
}

function filterFavorites(favorites: readonly Favorite[], searchTerm: string): Favorite[] {
  const normalized = normalizeFavoriteName(searchTerm);
  if (normalized === '') return [...favorites];
  return favorites.filter((favorite) => normalizeFavoriteName(favorite.name).includes(normalized));
}

function upsertFavorite(favorites: readonly Favorite[], saved: Favorite): Favorite[] {
  const existingIndex = favorites.findIndex((favorite) => favorite.id === saved.id);
  if (existingIndex < 0) return [saved, ...favorites];

  return favorites.map((favorite) => (favorite.id === saved.id ? saved : favorite));
}

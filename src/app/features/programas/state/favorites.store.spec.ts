import { TestBed } from '@angular/core/testing';
import fc from 'fast-check';
import { of, Subject } from 'rxjs';

import type { Favorite, FavoriteContent } from '../interfaces/favorite.interface';
import { FavoritesService } from '../services/favorites.service';
import { FavoritesStore, normalizeFavoriteName } from './favorites.store';

const CONTENT: FavoriteContent = {
  generals: {
    name: 'Brasil 2027',
    description: null,
    plan: { id: 'study', display: 'Gira de estudio' },
    season: { id: '2027', display: '2027' },
    destination: { id: 'BRX', display: 'Brasil' },
    departureCity: 'Santiago',
  },
  schedule: {
    startDate: '2027-10-04',
    endDate: '2027-10-10',
    totalNights: 6,
    totalPassengers: 30,
    freePassengers: 2,
  },
  pricing: { usdIncreaseCLP: 50, brlIncreaseCLP: 10, utilityRate: 20, rechargeRate: 5 },
  crews: [],
  services: [],
};

function setup() {
  const service = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [FavoritesStore, { provide: FavoritesService, useValue: service }],
  });
  return { store: TestBed.inject(FavoritesStore), service };
}

describe('FavoritesStore', () => {
  it('carga la colección, publica el estado y filtra por nombre', () => {
    const response = new Subject<Favorite[]>();
    const { store, service } = setup();
    service.list.mockReturnValue(response);
    const first = favorite('1', 'Brasil pedagógico');
    const second = favorite('2', 'Argentina cultural');

    store.load('programa');
    expect(store.loading()).toBe(true);
    response.next([first, second]);
    response.complete();
    store.searchTerm.set('  BRASIL  ');

    expect(service.list).toHaveBeenCalledWith('programa');
    expect(store.loading()).toBe(false);
    expect(store.visibleFavorites()).toEqual([first]);
  });

  it('Feature: program-form, Property 27: Un nombre coincidente actualiza en vez de crear', () => {
    const { store, service } = setup();
    const selected = favorite('selected', 'Gira Brasil 2027');
    store.select(selected);

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.boolean(),
        (leadingSpaces, middleSpaces, upperCase) => {
          service.update.mockClear();
          service.create.mockClear();
          const separator = ' '.repeat(middleSpaces);
          const rawName = `${' '.repeat(leadingSpaces)}Gira${separator}Brasil${separator}2027 `;
          const name = upperCase
            ? rawName.toLocaleUpperCase('es-CL')
            : rawName.toLocaleLowerCase('es-CL');
          service.update.mockReturnValue(of({ ...selected, name: rawName.trim() }));

          store.save(name, CONTENT).subscribe();

          expect(service.update).toHaveBeenCalledOnce();
          expect(service.create).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('crea al guardar con otro nombre y agrega el resultado a la colección', () => {
    const { store, service } = setup();
    const created = favorite('new', 'Argentina');
    service.create.mockReturnValue(of(created));

    store.save(' Argentina ', CONTENT).subscribe();

    expect(service.create).toHaveBeenCalledWith({ name: 'Argentina', content: CONTENT });
    expect(store.favorites()).toEqual([created]);
    expect(store.selected()).toBe(created);
    expect(store.mutating()).toBe(false);
  });

  it('elimina de la colección y limpia la selección actual', () => {
    const { store, service } = setup();
    const selected = favorite('selected', 'Brasil');
    service.list.mockReturnValue(of([selected, favorite('other', 'Argentina')]));
    service.delete.mockReturnValue(of(undefined));
    store.load('programa');
    store.select(selected);

    store.delete(selected).subscribe();

    expect(store.favorites().map(({ id }) => id)).toEqual(['other']);
    expect(store.selected()).toBeNull();
    expect(store.mutating()).toBe(false);
  });

  it('normaliza espacios y mayúsculas con reglas de español', () => {
    expect(normalizeFavoriteName('  GIRA   BRASIL  ')).toBe('gira brasil');
  });
});

function favorite(id: string, name: string): Favorite {
  return {
    id,
    name,
    scope: 'programa',
    content: CONTENT,
    createdAt: '2026-09-14T12:00:00Z',
    updatedAt: '2026-09-14T12:00:00Z',
  };
}

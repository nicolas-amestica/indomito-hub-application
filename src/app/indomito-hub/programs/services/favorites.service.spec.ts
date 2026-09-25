import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import type { Favorite, FavoriteUpsertRequest } from '../interfaces/favorite.interface';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FavoritesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista y desenvuelve los favoritos del scope', () => {
    const favorite = sampleFavorite();
    let received: Favorite[] | undefined;

    service.list('cotizacion').subscribe((value) => (received = value));
    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/cotizaciones` &&
        candidate.params.get('scope') === 'cotizacion',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: [favorite] });

    expect(received).toEqual([favorite]);
  });

  it('crea y actualiza con el mismo cuerpo persistible', () => {
    const body: FavoriteUpsertRequest = {
      name: 'Brasil',
      content: sampleFavorite().content,
    };
    const created = sampleFavorite();
    const updated = { ...created, name: 'Brasil actualizado' };
    const received: Favorite[] = [];

    service.create(body).subscribe((value) => received.push(value));
    const createRequest = http.expectOne(`${environment.apiUrl}/cotizaciones`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(body);
    createRequest.flush({ data: created });

    service.update('01/a', body).subscribe((value) => received.push(value));
    const updateRequest = http.expectOne(`${environment.apiUrl}/cotizaciones/01%2Fa`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(body);
    updateRequest.flush({ data: updated });

    expect(received).toEqual([created, updated]);
  });

  it('elimina por identificador y acepta una respuesta sin cuerpo', () => {
    let completed = false;

    service.delete('favorite-1').subscribe({ complete: () => (completed = true) });
    const request = http.expectOne(`${environment.apiUrl}/cotizaciones/favorite-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});

function sampleFavorite(): Favorite {
  return {
    id: '01JQZ8AAAAAAAAAAAAAAAAAAAA',
    name: 'Brasil',
    scope: 'cotizacion',
    content: {
      generals: {
        name: 'Brasil 2027',
        description: null,
        plan: { id: 'study', display: 'Gira de estudio' },
        season: { id: '2027', display: '2027' },
        destination: { id: 'BRX', display: 'Brasil' },
        departureCity: 'Santiago',
      },
      schedule: {
        totalDays: 7,
        totalNights: 6,
        totalPassengers: 30,
        freePassengers: 2,
      },
      pricing: {
        usdIncreaseCLP: 50,
        brlIncreaseCLP: 10,
        utilityRate: 20,
        rechargeRate: 5,
      },
      crews: [],
      services: [],
    },
    createdAt: '2026-09-14T12:00:00Z',
    updatedAt: '2026-09-14T12:00:00Z',
  };
}

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CollectionTreasury } from '../../services/collection-treasury';
import { GlobalCollectionAlertsPage } from './global-collection-alerts.page';

describe('GlobalCollectionAlertsPage', () => {
  it('explica el patron economico y enlaza el detalle de la gira', async () => {
    const api = {
      getGlobalAlerts: vi.fn().mockReturnValue(
        of({
          year: '2027',
          asOf: '2027-02-01',
          overdue: 1000,
          outstanding: 2000,
          groups: [
            {
              tripId: 'trip',
              institutionName: 'Colegio',
              destination: 'Sur',
              overdue: 1000,
              outstanding: 2000,
              travelDateDefined: false,
              dueByCutoff: 0,
              accounts: [],
            },
          ],
        }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [GlobalCollectionAlertsPage],
      providers: [provideRouter([]), { provide: CollectionTreasury, useValue: api }],
    });
    const fixture = TestBed.createComponent(GlobalCollectionAlertsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No recorre la tabla de pagos');
    expect(
      fixture.nativeElement.querySelector('a[href="/cobranza/giras/trip/alertas"]'),
    ).not.toBeNull();
  });
});

import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import type { Favorite } from '../../interfaces/favorite.interface';
import { FavoritesPanelComponent } from './favorites-panel.component';

describe('FavoritesPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
  });

  it('muestra el estado vacío y permite cerrar desde la capa móvil', async () => {
    const fixture = createFixture([]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('No hay cotizaciones para mostrar.');
    host.querySelector<HTMLButtonElement>('[aria-label="Cerrar panel de cotizaciones"]')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('expone seleccionar, visualizar y confirmar antes de eliminar', async () => {
    const item = favorite();
    const fixture = createFixture([item]);
    const selected = vi.fn();
    const deleted = vi.fn();
    fixture.componentInstance.favoriteSelected.subscribe(selected);
    fixture.componentInstance.favoriteDeleted.subscribe(deleted);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    buttonNamed(host, 'Seleccionar').click();
    buttonNamed(host, 'Visualizar').click();
    await fixture.whenStable();
    expect(selected).toHaveBeenCalledWith(item);
    expect(host.textContent).toContain('30 totales');

    buttonNamed(host, 'Eliminar').click();
    await fixture.whenStable();
    expect(deleted).not.toHaveBeenCalled();
    const deleteButtons = [...host.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => button.textContent?.trim() === 'Eliminar',
    );
    deleteButtons.at(-1)?.click();
    await fixture.whenStable();
    expect(deleted).toHaveBeenCalledWith(item);
  });

  it('solicita un nombre no vacío antes de guardar', async () => {
    const fixture = createFixture([]);
    const submitted = vi.fn();
    fixture.componentInstance.saveSubmitted.subscribe(submitted);
    fixture.componentRef.setInput('saveDialogVisible', true);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(buttonNamed(host, 'Guardar').disabled).toBe(true);
    const input = host.querySelector<HTMLInputElement>('#favorite-name')!;
    input.value = 'Mi programa';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    buttonNamed(host, 'Guardar').click();

    expect(submitted).toHaveBeenCalledWith('Mi programa');
  });
});

function createFixture(favorites: Favorite[]) {
  const fixture = TestBed.createComponent(FavoritesPanelComponent);
  fixture.componentRef.setInput('scope', 'cotizacion');
  fixture.componentRef.setInput('favorites', favorites);
  fixture.componentRef.setInput('visible', true);
  return fixture;
}

function favorite(): Favorite {
  return {
    id: 'favorite-1',
    name: 'Brasil pedagógico',
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

function buttonNamed(host: HTMLElement, text: string): HTMLButtonElement {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === text,
  )!;
}

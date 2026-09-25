import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), MessageService],
    }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('expone el punto de montaje de las rutas', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('router-outlet')).not.toBeNull();
  });

  it('aloja el único contenedor global de notificaciones', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('p-toast')).not.toBeNull();
  });
});

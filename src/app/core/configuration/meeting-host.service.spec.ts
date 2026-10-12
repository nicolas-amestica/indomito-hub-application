import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { MeetingHostService } from './meeting-host.service';

describe('MeetingHostService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }));

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('uses the read-only options endpoint for the meeting agenda', () => {
    let received: unknown;
    TestBed.inject(MeetingHostService).listOptions().subscribe(value => (received = value));
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/configuracion/anfitriones:opciones`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { items: [{ id: 'host-1', name: 'Ana' }] } });
    expect(received).toEqual([{ id: 'host-1', name: 'Ana' }]);
  });

  it('sends host updates to the encoded resource URL', () => {
    const body = { name: 'Ana', description: '', color: '#112233', active: true, isDefault: true };
    TestBed.inject(MeetingHostService).update('host/1', body).subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/configuracion/anfitriones/host%2F1`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ data: { id: 'host/1', ...body } });
  });
});

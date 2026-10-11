import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { MeetService, type MeetRequest } from './meet.service';

const meeting: MeetRequest = {
  title: 'Reunión de coordinación',
  date: '2026-10-11',
  startTime: '11:00',
  endTime: '12:00',
  description: '',
  guests: ['test@example.com'],
  hostSk: null,
  hostName: null,
  hostColor: null,
  idempotencyKey: 'unique-retry-key',
};

describe('MeetService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('queries the selected month with the correct calendar parameters', () => {
    const service = TestBed.inject(MeetService);
    let received: unknown;
    service.list(2026, 10).subscribe((events) => (received = events));
    const req = TestBed.inject(HttpTestingController).expectOne(
      (call) =>
        call.url === `${environment.apiUrl}/v1/reuniones` &&
        call.params.get('year') === '2026' &&
        call.params.get('month') === '10',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
    expect(received).toEqual([]);
  });

  it('preserves the idempotency key when creating a meeting', () => {
    TestBed.inject(MeetService).create(meeting).subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/v1/reuniones`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(meeting);
    req.flush({ data: { id: 'calendar-id' } });
  });

  it('encodes event IDs for updates and removals', () => {
    const api = TestBed.inject(MeetService);
    api.update('event/1', meeting).subscribe();
    let req = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/v1/reuniones/event%2F1`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.endTime).toBe('12:00');
    req.flush({ data: { id: 'event/1' } });

    api.remove('event/1').subscribe();
    req = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiUrl}/v1/reuniones/event%2F1`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
  });
});

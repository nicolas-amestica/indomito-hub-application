import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { InboxApiService } from './inbox-api.service';

describe('InboxApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('construye el listado inicial con el pageSize contractual', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);

    service.list({ query: 'María' }).subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/conversaciones`,
    );
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('200');
    expect(request.request.params.get('q')).toBe('María');
    request.flush({});
  });

  it('no mezcla before y since cuando el caller solicita historial anterior', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);

    service.detail('56912345678', { before: 'cursor-opaco' }).subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/conversaciones/56912345678`,
    );
    expect(request.request.params.get('before')).toBe('cursor-opaco');
    expect(request.request.params.has('since')).toBe(false);
    expect(request.request.params.get('pageSize')).toBe('50');
    request.flush({});
  });

  it('envía una respuesta con idempotencia explícita en el body', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);

    service.sendReply('56912345678', 'Hola', '8cf45157-b5dd-40f1-9443-61b80f1c2635').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/conversaciones/56912345678/respuestas`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      content: 'Hola',
      clientMessageId: '8cf45157-b5dd-40f1-9443-61b80f1c2635',
    });
    request.flush({});
  });

  it('prepara el lote de adjuntos sin alterar checksum ni clientMessageId', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);
    const files = [{
      clientMessageId: '8cf45157-b5dd-40f1-9443-61b80f1c2635',
      fileName: 'documento.pdf',
      mimeType: 'application/pdf' as const,
      size: 128,
      checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    }];

    service.prepareAttachments('56912345678', '3dc9ae72-d924-4ab2-af5a-fc11a575cf8c', files).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/conversaciones/56912345678/adjuntos/preparar`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      batchId: '3dc9ae72-d924-4ab2-af5a-fc11a575cf8c',
      files,
    });
    request.flush({});
  });

  it('reintenta un envío con body vacío', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);
    const id = '8cf45157-b5dd-40f1-9443-61b80f1c2635';

    service.retrySend(id).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/envios-inbox/${id}/reintentar`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({});
  });

  it('marca toda la bandeja con Idempotency-Key', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);
    const idempotencyKey = '3dc9ae72-d924-4ab2-af5a-fc11a575cf8c';

    service.markAllRead(idempotencyKey).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/conversaciones/acciones/marcar-leidas`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('Idempotency-Key')).toBe(idempotencyKey);
    expect(request.request.body).toEqual({});
    request.flush({});
  });

  it('elimina una conversación sin enviar body', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);

    service.deleteConversation('56912345678').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/conversaciones/56912345678`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush({});
  });

  it('reactiva explícitamente el agente IA de una conversación', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);

    service.reactivateAgent('56912345678').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/conversaciones/56912345678/estado-agente`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'bot' });
    request.flush({});
  });

  it('consulta la operación masiva activa por tipo', () => {
    const service = TestBed.inject(InboxApiService);
    const http = TestBed.inject(HttpTestingController);

    service.activeBulk('mark_all_read').subscribe();

    const request = http.expectOne((candidate) =>
      candidate.url === `${environment.apiUrl}/operaciones-inbox` &&
      candidate.params.get('kind') === 'mark_all_read' &&
      candidate.params.get('state') === 'active',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: null });
  });
});

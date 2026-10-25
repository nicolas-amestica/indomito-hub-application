import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type {
  ConversationDetailResponse,
  ConversationListResponse,
  AttachmentPreparationItem,
  PrepareAttachmentsResponse,
  PreparedAttachmentUpload,
  BulkOperation,
  ConversationSummary,
  SendState,
  WhatsAppTemplate,
  MessageRichContent,
} from '../interfaces/conversation.interface';

export interface ConversationListQuery {
  readonly page?: number;
  readonly cursor?: string;
  readonly query?: string;
}

export interface ConversationDetailQuery {
  readonly before?: string;
  readonly since?: string;
  readonly pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class InboxApiService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = environment.apiUrl;
  private readonly baseUrl = `${environment.apiUrl}/conversaciones`;

  list(query: ConversationListQuery = {}): Observable<ConversationListResponse> {
    let params = new HttpParams().set('page', query.page ?? 1).set('pageSize', 200);
    if (query.cursor) params = params.set('cursor', query.cursor);
    if (query.query) params = params.set('q', query.query);
    return this.http.get<ConversationListResponse>(this.baseUrl, { params });
  }

  detail(phone: string, query: ConversationDetailQuery = {}): Observable<ConversationDetailResponse> {
    let params = new HttpParams().set('pageSize', query.pageSize ?? 50);
    if (query.before) params = params.set('before', query.before);
    if (query.since) params = params.set('since', query.since);
    return this.http.get<{ data: ConversationDetailResponse }>(`${this.baseUrl}/${phone}`, { params }).pipe(
      map(({ data }) => data),
    );
  }

  sendReply(phone: string, content: string, clientMessageId: string, replyToMessageId?: string): Observable<{ data: SendState }> {
    return this.http.post<{ data: SendState }>(`${this.baseUrl}/${phone}/respuestas`, {
      content,
      clientMessageId,
      ...(replyToMessageId ? { replyToMessageId } : {}),
    });
  }

  listTemplates(): Observable<{ data: readonly WhatsAppTemplate[] }> {
    return this.http.get<{ data: readonly WhatsAppTemplate[] }>(`${this.apiRoot}/plantillas-whatsapp`);
  }

  sendTemplate(phone: string, clientMessageId: string, template: WhatsAppTemplate, parameters: readonly string[]): Observable<{ data: SendState }> {
    return this.http.post<{ data: SendState }>(`${this.baseUrl}/${phone}/plantillas`, {
      clientMessageId,
      name: template.name,
      language: template.language,
      parameters,
    });
  }

  setReaction(phone: string, messageId: string, emoji: string): Observable<{ data: { messageId: string; emoji: string } }> {
    return this.http.put<{ data: { messageId: string; emoji: string } }>(`${this.baseUrl}/${phone}/reacciones`, { messageId, emoji });
  }

  sendRichMessage(phone: string, clientMessageId: string, rich: Pick<MessageRichContent, 'kind' | 'location' | 'contacts' | 'interactive'>): Observable<{ data: SendState }> {
    return this.http.post<{ data: SendState }>(`${this.baseUrl}/${phone}/mensajes-enriquecidos`, {
      clientMessageId,
      ...rich,
    });
  }

  prepareAttachments(phone: string, batchId: string, files: readonly AttachmentPreparationItem[]): Observable<{ data: PrepareAttachmentsResponse }> {
    return this.http.post<{ data: PrepareAttachmentsResponse }>(
      `${this.baseUrl}/${phone}/adjuntos/preparar`,
      { batchId, files },
    );
  }

  async uploadPrepared(file: File, upload: PreparedAttachmentUpload): Promise<void> {
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: upload.requiredHeaders,
      body: file,
    });
    if (!response.ok) throw new Error(`Attachment upload failed with status ${response.status}`);
  }

  sendAttachment(phone: string, upload: PreparedAttachmentUpload, caption: string, kind?: 'sticker'): Observable<{ data: SendState }> {
    return this.http.post<{ data: SendState }>(`${this.baseUrl}/${phone}/adjuntos`, {
      uploadId: upload.uploadId,
      key: upload.key,
      caption,
      clientMessageId: upload.clientMessageId,
      ...(kind ? { kind } : {}),
    });
  }

  getSend(clientMessageId: string): Observable<{ data: SendState }> {
    return this.http.get<{ data: SendState }>(`${environment.apiUrl}/envios-inbox/${clientMessageId}`);
  }

  retrySend(clientMessageId: string): Observable<{ data: SendState }> {
    return this.http.post<{ data: SendState }>(
      `${environment.apiUrl}/envios-inbox/${clientMessageId}/reintentar`,
      {},
    );
  }

  updateContact(phone: string, name: string): Observable<{ data: { phone: string; name: string } }> {
    return this.http.patch<{ data: { phone: string; name: string } }>(
      `${this.baseUrl}/${phone}/contacto`,
      { name },
    );
  }

  markUnread(phone: string): Observable<{ data: ConversationSummary }> {
    return this.http.patch<{ data: ConversationSummary }>(
      `${this.baseUrl}/${phone}/estado-lectura`,
      { unread: true },
    );
  }

  reactivateAgent(phone: string): Observable<{ data: ConversationSummary }> {
    return this.http.patch<{ data: ConversationSummary }>(
      `${this.baseUrl}/${phone}/estado-agente`,
      { status: 'bot' },
    );
  }

  deleteConversation(phone: string): Observable<{ data: { deleted: boolean } }> {
    return this.http.delete<{ data: { deleted: boolean } }>(`${this.baseUrl}/${phone}`);
  }

  markAllRead(idempotencyKey: string): Observable<{ data: BulkOperation }> {
    return this.http.patch<{ data: BulkOperation }>(
      `${this.baseUrl}/acciones/marcar-leidas`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  activeBulk(kind: BulkOperation['kind']): Observable<{ data: BulkOperation | null }> {
    const params = new HttpParams().set('kind', kind).set('state', 'active');
    return this.http.get<{ data: BulkOperation | null }>(`${environment.apiUrl}/operaciones-inbox`, { params });
  }

  bulkOperation(operationId: string): Observable<{ data: BulkOperation }> {
    return this.http.get<{ data: BulkOperation }>(
      `${environment.apiUrl}/operaciones-inbox/${operationId}`,
    );
  }

  subscription(scope: 'list' | 'detail', phone?: string): Observable<{
    data: { url: string; ticket: string; expiresAt: string };
  }> {
    let params = new HttpParams().set('scope', scope);
    if (phone) params = params.set('phone', phone);
    return this.http.get<{ data: { url: string; ticket: string; expiresAt: string } }>(
      `${this.baseUrl}/suscripcion`,
      { params },
    );
  }
}

import type {
  ConversationStatus,
  DeliveryStatus,
  DetailWatermark,
  InboxMimeType,
  ListWatermark,
  MessageType,
} from '../types/inbox.types';

export interface PageInfo {
  readonly page: number;
  readonly pageSize: 200;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface ConversationSummary {
  readonly id: string;
  readonly phone: string;
  readonly alias: string;
  readonly channel: 'whatsapp';
  readonly status: ConversationStatus;
  readonly reason: 'sin_presupuesto' | 'sin_respuesta' | 'error_gemini' | null;
  readonly reasonLabel: string | null;
  readonly unreadCount: number;
  readonly lastMessagePreview: string | null;
  readonly lastMessageAt: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly generation: number;
}

export interface MessageAttachment {
  readonly fileName: string;
  readonly mimeType: InboxMimeType;
  readonly size: number;
  readonly downloadUrl: string | null;
}

export interface AttachmentPreparationItem {
  readonly clientMessageId: string;
  readonly fileName: string;
  readonly mimeType: InboxMimeType;
  readonly size: number;
  readonly checksumSha256: string;
}

export interface PreparedAttachmentUpload {
  readonly clientMessageId: string;
  readonly uploadId: string;
  readonly key: string;
  readonly uploadUrl: string;
  readonly method: 'PUT';
  readonly requiredHeaders: Readonly<Record<string, string>>;
}

export interface PrepareAttachmentsResponse {
  readonly batchId: string;
  readonly expiresAt: string;
  readonly uploads: readonly PreparedAttachmentUpload[];
}

export interface BulkOperation {
  readonly operationId: string;
  readonly kind: 'mark_all_read' | 'recalculate_unread';
  readonly state: 'materializing' | 'applying' | 'committed' | 'failed';
  readonly phase: 'materializing' | 'applying' | null;
  readonly targetCount: number;
  readonly processed: number;
  readonly applied: number;
  readonly unchanged: number;
  readonly failed: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface InboxMessage {
  readonly id: string;
  readonly msgSk: string;
  readonly phone: string;
  readonly type: MessageType;
  readonly content: string | null;
  readonly createdAt: string;
  readonly whatsappMessageId: string | null;
  readonly deliveryStatus: DeliveryStatus | null;
  readonly deliveryError: string | null;
  readonly attachments: readonly MessageAttachment[];
}

export interface ConversationListResponse {
  readonly data: readonly ConversationSummary[];
  readonly pageInfo: PageInfo;
  readonly nextCursor: string | null;
  readonly unreadTotal: number;
  readonly watermark: ListWatermark;
}

export interface ConversationDetailResponse {
  readonly mode: 'full' | 'before' | 'delta';
  readonly conversation: ConversationSummary | null;
  readonly messages: readonly InboxMessage[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
  readonly nonTerminalSends: readonly NonTerminalSend[];
  readonly watermark: DetailWatermark;
  readonly requestedBefore?: string;
  readonly requestedSince?: string;
}

interface SendStateBase {
  readonly clientMessageId: string;
  readonly phone: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly retryCount: 0 | 1;
  readonly preview: string | null;
  readonly attachment: Pick<MessageAttachment, 'fileName' | 'mimeType' | 'size'> | null;
}

export type NonTerminalSend = SendStateBase &
  (
    | { readonly state: 'reserved' | 'provider_pending' }
    | { readonly state: 'recovering'; readonly whatsappMessageId: string }
    | { readonly state: 'uncertain'; readonly resolutionRequired: true; readonly reason: string }
    | {
        readonly state: 'failed_retryable';
        readonly retryCount: 0;
        readonly retryAvailable: true;
        readonly error: string;
      }
  );

export type SendState =
  | NonTerminalSend
  | (SendStateBase & {
      readonly state: 'committed';
      readonly retryAvailable: false;
      readonly result: {
        readonly whatsappMessageId: string;
        readonly msgSk: string;
        readonly createdAt: string;
      };
    })
  | (SendStateBase & {
      readonly state: 'failed';
      readonly retryAvailable: false;
      readonly error: string;
    });

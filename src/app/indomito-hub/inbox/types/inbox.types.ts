export type ConversationFilter = 'all' | 'unread';
export type ConversationStatus = 'bot' | 'derived';
export type MessageType = 'customer' | 'ai_agent' | 'team';
export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type InboxMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'audio/ogg'
  | 'audio/webm';

export type ListWatermark = { readonly stream: 'list'; readonly sequence: number };
export type DetailWatermark = {
  readonly stream: `detail:${string}`;
  readonly sequence: number;
};

export type RealtimeEventType =
  | 'conversation.updated'
  | 'conversation.deleted'
  | 'message.created'
  | 'message.delivery.updated'
  | 'bulk.updated'
  | 'resync_required';

export interface RealtimeEnvelope {
  readonly eventId: string;
  readonly type: RealtimeEventType;
  readonly stream: 'list' | `detail:${string}`;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

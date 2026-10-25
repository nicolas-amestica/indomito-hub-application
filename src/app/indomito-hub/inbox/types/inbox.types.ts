export type ConversationFilter = 'all' | 'unread';
export type ConversationStatus = 'bot' | 'derived';
export type ServiceWindowState = 'open' | 'closed' | 'unknown';
export type MessageType = 'customer' | 'ai_agent' | 'team';
export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type InboxMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'audio/ogg'
  | 'audio/webm'
  | 'audio/aac'
  | 'audio/mpeg'
  | 'audio/mp4'
  | 'audio/wav'
  | 'audio/flac'
  | 'audio/amr'
  | 'video/mp4';

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
  | 'message.reactions.updated'
  | 'agent_processing'
  | 'bulk.updated'
  | 'resync_required';

interface RealtimeEnvelopeBase {
  readonly eventId: string;
  readonly stream: 'list' | `detail:${string}`;
  readonly sequence: number;
  readonly occurredAt: string;
}

export interface AgentProcessingPayload {
  readonly phone: string;
  readonly active: boolean;
  readonly expiresAt: string | null;
}

export interface AgentProcessingRealtimeEnvelope extends RealtimeEnvelopeBase {
  readonly type: 'agent_processing';
  readonly stream: `detail:${string}`;
  readonly payload: AgentProcessingPayload;
}

export interface StandardRealtimeEnvelope extends RealtimeEnvelopeBase {
  readonly type: Exclude<RealtimeEventType, 'agent_processing'>;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type RealtimeEnvelope = AgentProcessingRealtimeEnvelope | StandardRealtimeEnvelope;

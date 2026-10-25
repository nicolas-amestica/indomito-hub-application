import type { InboxMessage } from '../interfaces/conversation.interface';
import { buildMessageGroupContinuations } from './build-message-group-continuations';

describe('buildMessageGroupContinuations', () => {
  it('agrupa al mismo autor dentro de cinco minutos', () => {
    const grouped = buildMessageGroupContinuations([
      message('one', 'customer', '2026-10-23T12:00:00Z'),
      message('two', 'customer', '2026-10-23T12:04:59Z'),
      message('three', 'team', '2026-10-23T12:05:00Z'),
      message('four', 'team', '2026-10-23T12:10:01Z'),
    ]);

    expect([...grouped]).toEqual(['two']);
  });
});

function message(id: string, type: InboxMessage['type'], createdAt: string): InboxMessage {
  return {
    id,
    msgSk: `MSG#${id}`,
    phone: '56912345678',
    type,
    content: 'Mensaje',
    createdAt,
    whatsappMessageId: null,
    deliveryStatus: null,
    deliveryError: null,
    attachments: [],
    replyTo: null,
  };
}

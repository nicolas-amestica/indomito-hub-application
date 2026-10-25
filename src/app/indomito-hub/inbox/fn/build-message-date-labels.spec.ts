import type { InboxMessage } from '../interfaces/conversation.interface';
import { buildMessageDateLabels } from './build-message-date-labels';

describe('buildMessageDateLabels', () => {
  it('crea una etiqueta solo para el primer mensaje de cada día', () => {
    const messages = [
      message('one', '2026-10-22T10:00:00'),
      message('two', '2026-10-22T11:00:00'),
      message('three', '2026-10-23T09:00:00'),
    ];

    const labels = buildMessageDateLabels(messages, new Date('2026-10-23T12:00:00'));

    expect([...labels.entries()]).toEqual([['one', 'Ayer'], ['three', 'Hoy']]);
  });

  it('omite fechas inválidas sin alterar el agrupamiento válido', () => {
    const labels = buildMessageDateLabels([
      message('invalid', 'sin-fecha'),
      message('valid', '2026-10-23T09:00:00'),
    ], new Date('2026-10-23T12:00:00'));

    expect([...labels.entries()]).toEqual([['valid', 'Hoy']]);
  });
});

function message(id: string, createdAt: string): InboxMessage {
  return {
    id,
    msgSk: `MSG#${id}`,
    phone: '56912345678',
    type: 'customer',
    content: 'Mensaje',
    createdAt,
    whatsappMessageId: null,
    deliveryStatus: null,
    deliveryError: null,
    attachments: [],
    replyTo: null,
  };
}

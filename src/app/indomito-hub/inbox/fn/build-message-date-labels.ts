import type { InboxMessage } from '../interfaces/conversation.interface';

/** Construye las etiquetas que separan los mensajes por día local. */
export function buildMessageDateLabels(
  messages: readonly InboxMessage[],
  now = new Date(),
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  let previousDay = '';
  for (const message of messages) {
    const date = new Date(message.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const day = localDayKey(date);
    if (day === previousDay) continue;
    labels.set(message.id, formatDayLabel(date, now));
    previousDay = day;
  }
  return labels;
}

function formatDayLabel(date: Date, now: Date): string {
  const day = localDayKey(date);
  if (day === localDayKey(now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localDayKey(yesterday)) return 'Ayer';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function localDayKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

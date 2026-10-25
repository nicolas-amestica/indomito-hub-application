import type { InboxMessage } from '../interfaces/conversation.interface';

const GROUP_WINDOW_MS = 5 * 60_000;

/** Identifica mensajes que continúan visualmente al autor inmediatamente anterior. */
export function buildMessageGroupContinuations(
  messages: readonly InboxMessage[],
): ReadonlySet<string> {
  const continuations = new Set<string>();
  for (let index = 1; index < messages.length; index += 1) {
    const previous = messages[index - 1];
    const current = messages[index];
    if (!previous || !current || previous.type !== current.type) continue;
    const previousAt = Date.parse(previous.createdAt);
    const currentAt = Date.parse(current.createdAt);
    if (!Number.isFinite(previousAt) || !Number.isFinite(currentAt)) continue;
    if (currentAt >= previousAt && currentAt - previousAt <= GROUP_WINDOW_MS) {
      continuations.add(current.id);
    }
  }
  return continuations;
}

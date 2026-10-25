import type { ServiceWindowState } from '../types/inbox.types';

/** Determina si WhatsApp permite una respuesta libre según la última entrada del cliente. */
export function getServiceWindowState(
  expiresAt: string | null,
  now = Date.now(),
): ServiceWindowState {
  if (expiresAt === null) return 'unknown';
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return 'unknown';
  return expiry > now ? 'open' : 'closed';
}

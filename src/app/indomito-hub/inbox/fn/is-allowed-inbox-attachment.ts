import type { InboxMimeType } from '../types/inbox.types';

const MAX_ATTACHMENT_SIZE = 7 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set<InboxMimeType>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/amr',
  'video/mp4',
]);

/** Normaliza alias del navegador al MIME aceptado por el contrato del inbox. */
export function getInboxAttachmentMimeType(file: Pick<File, 'name' | 'type'>): InboxMimeType | null {
  const type = file.type.toLowerCase();
  if ((type === 'audio/x-m4a' || type === 'video/mp4') && file.name.toLowerCase().endsWith('.m4a')) {
    return 'audio/mp4';
  }
  return ALLOWED_ATTACHMENT_TYPES.has(type as InboxMimeType) ? (type as InboxMimeType) : null;
}

/** Valida el contrato local para adjuntos salientes del inbox. */
export function isAllowedInboxAttachment(file: Pick<File, 'name' | 'size' | 'type'>): boolean {
  return file.size > 0 && file.size <= MAX_ATTACHMENT_SIZE && getInboxAttachmentMimeType(file) !== null;
}

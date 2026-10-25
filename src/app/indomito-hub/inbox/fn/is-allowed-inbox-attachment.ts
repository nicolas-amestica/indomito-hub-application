const MAX_ATTACHMENT_SIZE = 7 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/amr',
  'video/mp4',
]);

/** Valida el contrato local para adjuntos salientes del inbox. */
export function isAllowedInboxAttachment(file: Pick<File, 'size' | 'type'>): boolean {
  return file.size > 0 && file.size <= MAX_ATTACHMENT_SIZE && ALLOWED_ATTACHMENT_TYPES.has(file.type);
}

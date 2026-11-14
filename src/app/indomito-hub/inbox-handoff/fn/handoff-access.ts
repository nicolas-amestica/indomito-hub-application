/** Lee el permiso del fragmento y valida su formato antes de enviarlo. */
export function handoffToken(fragment: string | null): string {
  const token = new URLSearchParams(fragment ?? '').get('token') ?? '';
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
}
/** Conserva únicamente un teléfono válido al navegar al Inbox autenticado. */
export function handoffConversationQuery(phone: string): { readonly telefono?: string } {
  return /^[0-9]{8,15}$/.test(phone) ? { telefono: phone } : {};
}

/** Acepta exclusivamente rutas internas y descarta destinos externos o ambiguos. */
export function safeLoginDestination(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value))
    return '/inicio';
  try {
    const target = new URL(value, 'https://hub.invalid');
    if (target.origin !== 'https://hub.invalid' || target.pathname === '/login') return '/inicio';
    return target.pathname + target.search;
  } catch {
    return '/inicio';
  }
}

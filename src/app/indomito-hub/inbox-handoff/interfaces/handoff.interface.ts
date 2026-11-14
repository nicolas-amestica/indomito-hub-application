/** Permiso de lectura emitido al canjear un enlace de derivación. */
export interface HandoffSession {
  readonly sessionToken: string;
  readonly expiresAt: string;
}
/** Mensaje de la conversación sin datos internos de almacenamiento o proveedores. */
export interface HandoffMessage {
  readonly id: string;
  readonly type: 'customer' | 'ai_agent' | 'team';
  readonly author: string;
  readonly createdAt: string;
  readonly text: string;
}
/** Página de historial limitada a la conversación autorizada. */
export interface HandoffPage {
  readonly phone: string;
  readonly alias: string;
  readonly reason: string;
  readonly derivedAt: string;
  readonly expiresAt: string;
  readonly messages: readonly HandoffMessage[];
  readonly nextBefore?: string;
}

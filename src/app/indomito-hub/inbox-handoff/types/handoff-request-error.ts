/** Resultado de acceso esperado, separado de los errores HTTP y de la sesión normal. */
export class HandoffRequestError extends Error {
  constructor(readonly kind: 'unavailable' | 'request_failed') {
    super(kind);
    this.name = 'HandoffRequestError';
  }
}

/**
 * Envelope de una respuesta exitosa del backend. Todos los microservicios Go
 * (`api-catalog`, `api-favorite`, `api-program`) envuelven el resultado en
 * `data`, según el contrato de `docs/standards/global/api-design.md`.
 */
export interface ApiSuccessEnvelope<T> {
  data: T;
}

/**
 * Envelope de una respuesta de error del backend. El catálogo de `code`
 * posibles lo define `docs/standards/global/api-design.md` y no se redefine
 * acá; esta feature no agrega códigos nuevos.
 *
 * `details` solo contiene datos que el cliente ya envió (por ejemplo, el
 * campo que falló una validación). Nunca información interna del servicio,
 * como el nombre de una tabla o el mensaje crudo de un SDK.
 */
export interface ApiErrorEnvelope {
  /** Código de error del catálogo, por ejemplo `VALIDATION_ERROR`. */
  code: string;
  /**
   * Mensaje del backend, pensado para diagnóstico y logs. Nunca se muestra
   * tal cual al usuario final: ver `core/http/error.interceptor.ts`.
   */
  message: string;
  /** Detalle adicional, acotado a datos que el cliente ya conocía. */
  details?: unknown;
  /** Identificador de trazabilidad, tomado del `requestId` del backend. */
  traceId: string;
}

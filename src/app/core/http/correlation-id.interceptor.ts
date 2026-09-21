import { HttpInterceptorFn } from '@angular/common/http';

/** Nombre de la cabecera de correlación, según `docs/standards/global/api-design.md`. */
const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/**
 * Genera un identificador único por operación HTTP y lo envía en la cabecera
 * `X-Correlation-Id`, para poder cruzar una petición del frontend con los
 * logs estructurados del backend.
 *
 * El identificador se genera una vez por petición (no se reutiliza entre
 * reintentos internos de RxJS), con `crypto.randomUUID()`, disponible en
 * todos los navegadores que soporta esta aplicación.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationId = crypto.randomUUID();
  return next(req.clone({ setHeaders: { [CORRELATION_ID_HEADER]: correlationId } }));
};

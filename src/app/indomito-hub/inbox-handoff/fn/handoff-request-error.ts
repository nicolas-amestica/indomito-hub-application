import { HttpErrorResponse } from '@angular/common/http';
import { HandoffRequestError } from '../types/handoff-request-error';

/** Traduce el fallo de transporte sin exponer mensajes crudos del backend a la vista. */
export function handoffRequestError(error: unknown): HandoffRequestError {
  return new HandoffRequestError(
    error instanceof HttpErrorResponse && [401, 403, 410].includes(error.status)
      ? 'unavailable'
      : 'request_failed',
  );
}

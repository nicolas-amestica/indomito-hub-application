import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { NotificationService } from '../notifications/notification.service';
import { ApiErrorEnvelope } from './api-response.interface';

/**
 * Mapa de `code` del backend a mensaje de usuario en español.
 *
 * Es la única fuente de mensajes de error de la aplicación: ningún
 * componente decide qué decirle al usuario, y el `message` que envía el
 * backend nunca se muestra crudo, porque está pensado para diagnóstico y
 * puede contener detalle interno.
 *
 * El catálogo de códigos lo define `docs/standards/global/api-design.md` y
 * esta feature no agrega códigos nuevos.
 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  UPSTREAM_SERVICE_ERROR:
    'No se pudieron obtener los tipos de cambio. Intenta nuevamente en unos minutos.',
  VALIDATION_ERROR: 'Hay datos del programa que no son válidos. Revisa el formulario.',
  REQUIRED_FIELD_MISSING: 'Falta completar un dato obligatorio del programa.',
  RESOURCE_NOT_FOUND: 'El favorito ya no existe. Actualiza el panel.',
};

/** Mensaje para un `code` fuera del mapa, o para una respuesta sin envelope de error. */
const FALLBACK_MESSAGE = 'Ocurrió un problema inesperado. Intenta nuevamente.';

/**
 * Traduce el `code` de una respuesta de error a un mensaje de usuario y lo
 * notifica con {@link NotificationService}. La petición sigue rechazando el
 * observable con el error original, para que cada store decida su propio
 * manejo de estado (por ejemplo, habilitar un botón de reintentar) sin
 * duplicar la traducción del mensaje.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const code = extractErrorCode(error);
        notifications.error(messageForCode(code));
      }
      return throwError(() => error);
    }),
  );
};

/** Extrae el `code` del envelope de error, si el cuerpo lo trae. */
function extractErrorCode(error: HttpErrorResponse): string | undefined {
  const body = error.error as Partial<ApiErrorEnvelope> | null;
  return typeof body?.code === 'string' ? body.code : undefined;
}

/** Resuelve el mensaje de usuario para un `code`, con el mensaje genérico como respaldo. */
function messageForCode(code: string | undefined): string {
  if (!code) return FALLBACK_MESSAGE;
  return ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}

import { HttpContextToken } from '@angular/common/http';

/** Solicitud con permiso propio que no debe adjuntar ni invalidar la sesión habitual. */
export const SKIP_SESSION_AUTH = new HttpContextToken<boolean>(() => false);
/** Estados esperados representados dentro de la página, sin notificación global. */
export const SILENT_HTTP_ERRORS = new HttpContextToken<boolean>(() => false);

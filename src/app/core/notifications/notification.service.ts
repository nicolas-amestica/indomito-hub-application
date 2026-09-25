import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { APP_MESSAGES } from '../../shared/constants/app-messages';

/** Duración por defecto de un toast, en milisegundos. */
const DEFAULT_LIFE_MS = 5000;

/**
 * Fachada sobre `MessageService` de PrimeNG.
 *
 * Ningún componente ni interceptor inyecta `MessageService` directamente:
 * este servicio es el único punto que conoce la forma de un toast de
 * PrimeNG, para que un cambio de librería de notificaciones no obligue a
 * tocar cada llamador.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);

  /** Muestra un toast de éxito. */
  success(message: string, life = DEFAULT_LIFE_MS): void {
    this.messageService.add({
      severity: 'success',
      summary: APP_MESSAGES.notificationSummary.success,
      detail: message,
      life,
    });
  }

  /** Muestra un toast de error. */
  error(message: string, life = DEFAULT_LIFE_MS): void {
    this.messageService.add({
      severity: 'error',
      summary: APP_MESSAGES.notificationSummary.error,
      detail: message,
      life,
    });
  }

  /** Muestra un toast de advertencia. */
  warn(message: string, life = DEFAULT_LIFE_MS): void {
    this.messageService.add({
      severity: 'warn',
      summary: APP_MESSAGES.notificationSummary.warn,
      detail: message,
      life,
    });
  }
}

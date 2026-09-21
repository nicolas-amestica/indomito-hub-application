import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

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
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: message, life });
  }

  /** Muestra un toast de error. */
  error(message: string, life = DEFAULT_LIFE_MS): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail: message, life });
  }

  /** Muestra un toast de advertencia. */
  warn(message: string, life = DEFAULT_LIFE_MS): void {
    this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: message, life });
  }
}

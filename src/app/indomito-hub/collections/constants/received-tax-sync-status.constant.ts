/** Estados de la solicitud manual, independientes de la lectura programada. */
export const RECEIVED_TAX_SYNC_STATUS = {
  PENDING: 'Pendiente',
  RUNNING: 'En ejecución',
  COMPLETED: 'Completada',
  FAILED: 'Fallida',
} as const;

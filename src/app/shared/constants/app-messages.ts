/** Catálogo único de mensajes visibles para el usuario. */
export const APP_MESSAGES = {
  notificationSummary: {
    success: 'Éxito',
    error: 'Error',
    warn: 'Advertencia',
  },
  http: {
    upstreamServiceError:
      'No se pudieron obtener los tipos de cambio. Intenta nuevamente en unos minutos.',
    validationError: 'Hay datos del programa que no son válidos. Revisa el formulario.',
    requiredFieldMissing: 'Falta completar un dato obligatorio del programa.',
    resourceNotFound: 'El favorito ya no existe. Actualiza el panel.',
    unexpected: 'Ocurrió un problema inesperado. Intenta nuevamente.',
  },
  forms: {
    reviewRequiredData: 'Revisa los datos obligatorios, los RUT y las fechas.',
    incompleteFields: (fields: readonly string[], remainder: number): string =>
      `Completa o corrige: ${fields.join(', ')}${remainder > 0 ? ` y ${remainder} campo(s) más` : ''}.`,
  },
  contracts: {
    excelImported: (passengers: number): string =>
      `Se precargaron ${passengers} pasajeros. Los campos siguen editables.`,
    excelReadError: 'No se pudo leer el Excel.',
    saved: 'Contrato guardado correctamente.',
    pendingApproval: 'Contrato enviado a aprobación.',
    rejected: 'Contrato rechazado. Puede corregirse y volver a enviarse.',
    cancelled: 'Contrato cancelado.',
    returnedToDraft: 'Contrato devuelto a borrador.',
    approved: 'Contrato aprobado y PDF definitivo almacenado.',
    initialConfigurationError: 'No se pudo cargar la configuración inicial del contrato.',
  },
  programs: {
    favoritesUnavailable: 'El guardado de favoritos no está disponible en este ambiente.',
    favoriteSaved: 'El favorito se guardó correctamente.',
    favoriteLoaded: 'El favorito se cargó con los tipos de cambio vigentes.',
    favoriteDeleted: 'El favorito se eliminó correctamente.',
    favoriteOperationError: 'No se pudo completar la operación con favoritos.',
    excelExportError: 'No se pudo exportar el detalle a Excel. Inténtalo nuevamente.',
    destinationRequired: 'Selecciona un destino antes de exportar el presupuesto.',
    pdfExportError: 'No se pudo exportar el presupuesto. Inténtalo nuevamente.',
  },
} as const;

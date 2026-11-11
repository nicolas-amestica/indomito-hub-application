/** Pares de contraste y bordes locales de recepción, sin modificar el preset global. */
export const RECEIVED_TAX_DESIGN_TOKENS = {
  message: {
    info: {
      background: 'light-dark(#f0f9ff, #102a3a)',
      color: 'light-dark(#075985, #7dd3fc)',
      borderColor: 'light-dark(#7dd3fc, #075985)',
    },
    warn: {
      background: 'light-dark(#fffbeb, #33240d)',
      color: 'light-dark(#78350f, #fcd34d)',
      borderColor: 'light-dark(#fcd34d, #92400e)',
    },
    error: {
      background: 'light-dark(#fef2f2, #351516)',
      color: 'light-dark(#991b1b, #fca5a5)',
      borderColor: 'light-dark(#fca5a5, #991b1b)',
    },
  },
  table: {
    headerCell: {
      borderColor:
        'light-dark(color-mix(in srgb, var(--color-line), transparent 25%), color-mix(in srgb, var(--color-line), transparent 45%))',
    },
    bodyCell: {
      borderColor:
        'light-dark(color-mix(in srgb, var(--color-line), transparent 25%), color-mix(in srgb, var(--color-line), transparent 45%))',
    },
    root: {
      borderColor:
        'light-dark(color-mix(in srgb, var(--color-line), transparent 25%), color-mix(in srgb, var(--color-line), transparent 45%))',
    },
  },
  calendar: {
    header: {
      borderColor:
        'light-dark(color-mix(in srgb, var(--color-line), transparent 25%), color-mix(in srgb, var(--color-line), transparent 45%))',
    },
  },
} as const;

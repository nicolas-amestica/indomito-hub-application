/** Pares de contraste locales a Analítica; no alteran el preset global del proyecto. */
export const BALANCE_MESSAGE_TOKENS = {
  colorScheme: {
    light: {
      info: { color: '{blue.800}', background: '{blue.50}' },
      warn: { color: '{amber.900}', background: '{amber.50}' },
      success: { color: '{green.800}', background: '{green.50}' },
      error: { color: '{red.800}', background: '{red.50}' },
    },
    dark: {
      info: { color: '{blue.200}', background: '{blue.950}' },
      warn: { color: '{amber.200}', background: '{amber.950}' },
      success: { color: '{green.200}', background: '{green.950}' },
      error: { color: '{red.200}', background: '{red.950}' },
    },
  },
};
export const BALANCE_TAG_TOKENS = {
  secondary: { background: 'var(--color-line)', color: 'var(--color-ink)' },
};
export const BALANCE_EXPORT_TOKENS = {
  root: {
    secondary: {
      background: 'var(--color-line)',
      hoverBackground: 'var(--color-line)',
      activeBackground: 'var(--color-line)',
      color: 'var(--color-ink)',
      hoverColor: 'var(--color-ink)',
      activeColor: 'var(--color-ink)',
      borderColor: 'var(--color-control-border)',
    },
  },
};

/** Variantes locales que conservan las parejas de contraste de los tokens compartidos. */
export const MEETING_MESSAGE_TOKENS = {
  secondary: {
    background: 'var(--color-canvas)',
    color: 'var(--color-ink)',
    borderColor: 'color-mix(in srgb, var(--color-line), transparent 45%)',
  },
  info: {
    background: '{toast.info.background}',
    color: '{toast.info.color}',
    borderColor: '{toast.info.border.color}',
  },
  warn: {
    background: '{toast.warn.background}',
    color: '{toast.warn.color}',
    borderColor: '{toast.warn.border.color}',
  },
  error: {
    background: '{toast.error.background}',
    color: '{toast.error.color}',
    borderColor: '{toast.error.border.color}',
  },
};

export const MEETING_BUTTON_TOKENS = {
  root: {
    danger: {
      background: 'light-dark({red.700}, {red.300})',
      hoverBackground: 'light-dark({red.800}, {red.200})',
      activeBackground: 'light-dark({red.900}, {red.100})',
      borderColor: 'light-dark({red.700}, {red.300})',
      hoverBorderColor: 'light-dark({red.800}, {red.200})',
      activeBorderColor: 'light-dark({red.900}, {red.100})',
      color: 'light-dark(#ffffff, var(--color-night))',
      hoverColor: 'light-dark(#ffffff, var(--color-night))',
      activeColor: 'light-dark(#ffffff, var(--color-night))',
    },
  },
  outlined: {
    secondary: {
      color: 'var(--color-ink)',
      borderColor: 'var(--color-control-border)',
      hoverBackground: 'var(--color-canvas)',
      activeBackground: 'var(--color-line)',
    },
    danger: { color: '{toast.error.color}' },
  },
  text: {
    secondary: {
      color: 'var(--color-ink)',
      hoverBackground: 'var(--color-canvas)',
      activeBackground: 'var(--color-line)',
    },
    info: {
      color: '{toast.info.color}',
      hoverBackground: '{toast.info.background}',
      activeBackground: '{toast.info.background}',
    },
    success: {
      color: '{toast.success.color}',
      hoverBackground: '{toast.success.background}',
      activeBackground: '{toast.success.background}',
    },
  },
};

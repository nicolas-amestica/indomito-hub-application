import type { MessageDesignTokens } from '@primeuix/themes/types/message';
import type { PanelDesignTokens } from '@primeuix/themes/types/panel';

const panelBorder =
  'light-dark(color-mix(in srgb, var(--color-line) 75%, transparent), color-mix(in srgb, var(--color-line) 55%, transparent))';

/** Tokens locales del panel; no alteran el preset global ni otras pantallas. */
export const HANDOFF_PANEL_TOKENS: PanelDesignTokens = {
  root: {
    background: 'var(--color-surface)',
    color: 'var(--color-ink)',
    borderColor: panelBorder,
    borderRadius: '1rem',
  },
  header: {
    background: 'var(--color-surface)',
    color: 'var(--color-ink)',
    borderColor: panelBorder,
    borderWidth: '0',
    borderRadius: '1rem 1rem 0 0',
    padding: '1.25rem 1.25rem 0.75rem',
  },
  content: { padding: '0 1.25rem 1.25rem' },
};

/** Pares de severidad accesibles en claro y oscuro, acotados a esta vista. */
export const HANDOFF_MESSAGE_TOKENS: MessageDesignTokens = {
  warn: {
    background: 'light-dark({amber.50}, {amber.950})',
    color: 'light-dark({amber.900}, {amber.200})',
    borderColor: 'light-dark({amber.200}, {amber.800})',
  },
  info: {
    background: 'light-dark({sky.50}, {sky.950})',
    color: 'light-dark({sky.900}, {sky.200})',
    borderColor: 'light-dark({sky.200}, {sky.800})',
  },
};

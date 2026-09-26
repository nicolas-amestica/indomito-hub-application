import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/** Tema ejecutivo compartido. Los valores de marca viven en styles.css. */
export const IndomitoPreset = definePreset(Aura, {
  semantic: {
    typography: { fontFamily: 'var(--font-sans)', fontSize: '0.875rem' },
    primary: {
      50: 'var(--color-brand-soft)',
      100: 'var(--color-brand-soft)',
      200: 'var(--color-brand)',
      300: 'var(--color-brand)',
      400: 'var(--color-brand)',
      500: 'var(--color-brand)',
      600: 'var(--color-graphite)',
      700: 'var(--color-graphite)',
      800: 'var(--color-ink)',
      900: 'var(--color-ink)',
      950: 'var(--color-ink)',
      color: 'var(--color-brand)',
      contrastColor: 'var(--color-night)',
      hoverColor: 'var(--color-brand-hover)',
      activeColor: 'var(--color-brand-active)',
    },
    surface: {
      0: 'var(--color-surface)',
      50: 'var(--color-canvas)',
      100: '#F1F2F3',
      200: 'var(--color-line)',
      300: '#D0D1D3',
      400: 'var(--color-control-border)',
      500: 'var(--color-muted)',
      600: 'var(--color-graphite)',
      700: 'var(--color-graphite)',
      800: 'var(--color-graphite)',
      900: 'var(--color-ink)',
      950: 'var(--color-ink)',
    },
    text: { color: 'var(--color-ink)', mutedColor: 'var(--color-muted)' },
    highlight: {
      background: 'var(--color-brand-soft)',
      focusBackground: 'var(--color-brand)',
      color: 'var(--color-ink)',
      focusColor: 'var(--color-ink)',
    },
  },
});

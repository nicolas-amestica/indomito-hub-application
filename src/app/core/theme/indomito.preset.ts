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
      contrastColor: 'var(--color-ink)',
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
    focusRing: { width: '2px', color: 'var(--color-graphite)', offset: '3px' },
    formField: {
      paddingX: '0.875rem',
      paddingY: '0.6875rem',
      borderRadius: 'var(--radius-control)',
      borderColor: 'var(--color-control-border)',
      hoverBorderColor: 'var(--color-graphite)',
      focusBorderColor: 'var(--color-graphite)',
      focusRing: {
        width: '2px',
        style: 'solid',
        color: 'var(--color-graphite)',
        offset: '2px',
        shadow: 'none',
      },
    },
    highlight: {
      background: 'var(--color-brand-soft)',
      focusBackground: 'var(--color-brand)',
      color: 'var(--color-ink)',
      focusColor: 'var(--color-ink)',
    },
  },
  components: {
    panel: {
      root: { borderRadius: 'var(--radius-panel)' },
      header: { padding: '1.25rem 1.5rem', borderWidth: '0 0 1px 0' },
      toggleableHeader: { padding: '1rem 1.5rem' },
      title: { fontSize: '1rem', fontWeight: '600' },
    },
    button: {
      root: {
        paddingX: '1.25rem',
        label: { fontWeight: '600' },
        primary: { focusRing: { color: 'var(--color-graphite)' } },
      },
    },
  },
});

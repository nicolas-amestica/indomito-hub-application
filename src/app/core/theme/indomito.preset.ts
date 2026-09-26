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
    list: {
      option: {
        focusBackground: 'var(--color-line)',
        focusColor: 'var(--color-ink)',
        selectedBackground: 'var(--color-brand-soft)',
        selectedFocusBackground: 'var(--color-brand)',
        selectedColor: 'var(--color-ink)',
        selectedFocusColor: 'var(--color-night)',
      },
    },
  },
  components: {
    panel: {
      root: {
        borderColor: 'color-mix(in srgb, var(--color-line), transparent 45%)',
      },
    },
    toast: {
      success: {
        background: 'light-dark(#f0fdf4, #132e1d)',
        borderColor: 'light-dark(#86efac, #166534)',
        color: 'light-dark(#166534, #86efac)',
        detailColor: 'light-dark(#14532d, #f4f4f5)',
      },
      info: {
        background: 'light-dark(#f0f9ff, #102a3a)',
        borderColor: 'light-dark(#7dd3fc, #075985)',
        color: 'light-dark(#0369a1, #7dd3fc)',
        detailColor: 'light-dark(#0c4a6e, #f4f4f5)',
      },
      warn: {
        background: 'light-dark(#fffbeb, #33240d)',
        borderColor: 'light-dark(#fcd34d, #92400e)',
        color: 'light-dark(#92400e, #fcd34d)',
        detailColor: 'light-dark(#78350f, #f4f4f5)',
      },
      error: {
        background: 'light-dark(#fef2f2, #351516)',
        borderColor: 'light-dark(#fca5a5, #991b1b)',
        color: 'light-dark(#b91c1c, #fca5a5)',
        detailColor: 'light-dark(#7f1d1d, #f4f4f5)',
      },
    },
  },
});

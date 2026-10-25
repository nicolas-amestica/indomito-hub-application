export const focusAfterRender = (element: () => HTMLElement | undefined): number =>
  requestAnimationFrame(() => element()?.focus());

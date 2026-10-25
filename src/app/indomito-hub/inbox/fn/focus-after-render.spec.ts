import { focusAfterRender } from './focus-after-render';

describe('focusAfterRender', () => {
  it('mueve el foco solo después del siguiente frame', () => {
    let renderCallback: FrameRequestCallback | undefined;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      renderCallback = callback;
      return 17;
    });
    const target = document.createElement('main');
    target.tabIndex = -1;
    document.body.append(target);

    const frame = focusAfterRender(() => target);

    expect(frame).toBe(17);
    expect(document.activeElement).not.toBe(target);
    renderCallback?.(0);
    expect(document.activeElement).toBe(target);
    target.remove();
  });

  it('tolera que el destino ya no exista al renderizar', () => {
    let renderCallback: FrameRequestCallback | undefined;
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      renderCallback = callback;
      return 18;
    });

    expect(() => {
      focusAfterRender(() => undefined);
      renderCallback?.(0);
    }).not.toThrow();
  });
});

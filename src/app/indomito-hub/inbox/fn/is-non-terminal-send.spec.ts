import { isNonTerminalSend } from './is-non-terminal-send';

describe('isNonTerminalSend', () => {
  for (const [state, expected] of [
    ['reserved', true],
    ['provider_pending', true],
    ['recovering', true],
    ['uncertain', true],
    ['failed_retryable', true],
    ['committed', false],
    ['failed', false],
    ['unexpected', false],
  ] as const) {
    it(`clasifica ${state} como non-terminal=${expected}`, () => {
      expect(isNonTerminalSend({ state })).toBe(expected);
    });
  }
});

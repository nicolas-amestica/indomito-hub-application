import { isAllowedInboxAttachment } from './is-allowed-inbox-attachment';

describe('isAllowedInboxAttachment', () => {
  it.each([
    { type: 'application/pdf', expected: true },
    { type: 'audio/ogg', expected: true },
    { type: 'audio/mp4', expected: true },
    { type: 'audio/webm', expected: false },
    { type: 'video/mp4', expected: true },
    { type: 'video/webm', expected: false },
    { type: 'application/x-msdownload', expected: false },
  ])('valida $type', ({ type, expected }) => {
    expect(isAllowedInboxAttachment({ type, size: 1024 })).toBe(expected);
  });

  it('rechaza archivos vacíos o mayores a 7 MiB', () => {
    expect(isAllowedInboxAttachment({ type: 'video/mp4', size: 0 })).toBe(false);
    expect(isAllowedInboxAttachment({ type: 'video/mp4', size: 7 * 1024 * 1024 + 1 })).toBe(false);
  });
});

import { getInboxAttachmentMimeType, isAllowedInboxAttachment } from './is-allowed-inbox-attachment';

describe('isAllowedInboxAttachment', () => {
  it.each([
    { type: 'application/pdf', expected: true },
    { type: 'image/gif', expected: false },
    { type: 'image/webp', expected: false },
    { type: 'audio/ogg', expected: true },
    { type: 'audio/mp4', expected: true },
    { type: 'audio/webm', expected: false },
    { type: 'video/mp4', expected: true },
    { type: 'video/webm', expected: false },
    { type: 'application/x-msdownload', expected: false },
  ])('valida $type', ({ type, expected }) => {
    expect(isAllowedInboxAttachment({ name: 'fixture.bin', type, size: 1024 })).toBe(expected);
  });

  it.each(['audio/x-m4a', 'video/mp4'])('normaliza %s para archivos M4A', (type) => {
    const file = { name: 'audio.m4a', type };
    expect(getInboxAttachmentMimeType(file)).toBe('audio/mp4');
    expect(isAllowedInboxAttachment({ ...file, size: 1024 })).toBe(true);
  });

  it('no convierte un video MP4 real en audio', () => {
    expect(getInboxAttachmentMimeType({ name: 'video.mp4', type: 'video/mp4' })).toBe('video/mp4');
  });

  it('rechaza archivos vacíos o mayores a 7 MiB', () => {
    expect(isAllowedInboxAttachment({ name: 'video.mp4', type: 'video/mp4', size: 0 })).toBe(false);
    expect(isAllowedInboxAttachment({ name: 'video.mp4', type: 'video/mp4', size: 7 * 1024 * 1024 + 1 })).toBe(false);
  });
});

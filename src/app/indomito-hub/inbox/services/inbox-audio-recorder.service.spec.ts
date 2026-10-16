import { selectRecordingMimeType } from './inbox-audio-recorder.service';

describe('selectRecordingMimeType', () => {
  it('prefiere OGG Opus cuando el navegador lo soporta', () => {
    expect(selectRecordingMimeType(() => true)).toBe(
      'audio/ogg;codecs=opus',
    );
  });

  it('usa WebM Opus como alternativa compatible', () => {
    expect(selectRecordingMimeType((type) => type === 'audio/webm;codecs=opus')).toBe(
      'audio/webm;codecs=opus',
    );
  });

  it('informa ausencia de un codec permitido', () => {
    expect(selectRecordingMimeType(() => false)).toBeNull();
  });
});

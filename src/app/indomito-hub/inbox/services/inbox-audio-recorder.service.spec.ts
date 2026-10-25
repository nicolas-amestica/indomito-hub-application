import { selectRecordingMimeType } from './inbox-audio-recorder.service';

describe('selectRecordingMimeType', () => {
  it('prefiere OGG Opus cuando el navegador lo soporta', () => {
    expect(selectRecordingMimeType(() => true)).toBe(
      'audio/ogg;codecs=opus',
    );
  });

  it('usa audio MP4 como alternativa admitida por Meta', () => {
    expect(selectRecordingMimeType((type) => type === 'audio/mp4')).toBe('audio/mp4');
  });

  it('rechaza WebM porque Meta no lo admite como audio saliente', () => {
    expect(selectRecordingMimeType((type) => type === 'audio/webm;codecs=opus')).toBeNull();
  });

  it('informa ausencia de un codec permitido', () => {
    expect(selectRecordingMimeType(() => false)).toBeNull();
  });
});

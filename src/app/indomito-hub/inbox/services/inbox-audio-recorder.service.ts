import { Injectable } from '@angular/core';

const AUDIO_TYPES = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'] as const;

export function selectRecordingMimeType(
  supported: (mimeType: string) => boolean,
): string | null {
  return AUDIO_TYPES.find((mimeType) => supported(mimeType)) ?? null;
}

@Injectable()
export class InboxAudioRecorderService {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    if (this.recorder) throw new Error('A recording is already active');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Audio recording is unavailable');
    }
    const mimeType = selectRecordingMimeType(MediaRecorder.isTypeSupported);
    if (!mimeType) throw new Error('No supported audio codec');

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.recorder.start(250);
  }

  stop(): Promise<File> {
    const recorder = this.recorder;
    if (!recorder) return Promise.reject(new Error('No active recording'));

    return new Promise<File>((resolve, reject) => {
      recorder.addEventListener('error', () => {
        this.release();
        reject(new Error('Audio recording failed'));
      }, { once: true });
      recorder.addEventListener('stop', () => {
        const mimeType = normalizeRecordedMimeType(recorder.mimeType);
        const extension = mimeType === 'audio/ogg' ? 'ogg' : 'webm';
        const file = new File(this.chunks, `audio-${Date.now()}.${extension}`, { type: mimeType });
        this.release();
        resolve(file);
      }, { once: true });
      recorder.stop();
    });
  }

  cancel(): void {
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.release();
  }

  private release(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}

function normalizeRecordedMimeType(value: string): 'audio/ogg' | 'audio/webm' {
  return value.toLowerCase().startsWith('audio/ogg') ? 'audio/ogg' : 'audio/webm';
}

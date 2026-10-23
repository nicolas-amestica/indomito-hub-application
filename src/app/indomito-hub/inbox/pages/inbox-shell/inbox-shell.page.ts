import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { FileUpload, type FileUploadHandlerEvent } from 'primeng/fileupload';
import { Dialog } from 'primeng/dialog';
import { Tooltip } from 'primeng/tooltip';

import { ConversationListItemComponent } from '../../components/conversation-list-item/conversation-list-item.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { InboxStore } from '../../stores/inbox.store';
import { InboxAudioRecorderService } from '../../services/inbox-audio-recorder.service';
import { InboxRealtimeService } from '../../services/inbox-realtime.service';

@Component({
  selector: 'app-inbox-shell-page',
  imports: [ButtonDirective, ConversationListItemComponent, DatePipe, Dialog, FileUpload, HasPermissionDirective, InputText, Skeleton, Textarea, Tooltip],
  providers: [InboxAudioRecorderService, InboxRealtimeService, InboxStore],
  templateUrl: './inbox-shell.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxShellPage implements OnInit {
  readonly store = inject(InboxStore);
  readonly search = signal('');
  readonly reply = signal('');
  readonly selectedFiles = signal<readonly File[]>([]);
  readonly attachmentError = signal('');
  readonly recording = signal(false);
  readonly recordingSeconds = signal(0);
  readonly aliasDialogVisible = signal(false);
  readonly deleteDialogVisible = signal(false);
  readonly bulkDialogVisible = signal(false);
  readonly reactivateDialogVisible = signal(false);
  readonly alias = signal('');
  private readonly audioRecorder = inject(InboxAudioRecorderService);
  private readonly destroyRef = inject(DestroyRef);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private recordingTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cancelSearchTimer();
      this.cancelRecording();
    });
  }

  ngOnInit(): void {
    void this.store.load();
  }

  searchChanged(value: string): void {
    this.search.set(value);
    this.store.setQuery(value);
    this.cancelSearchTimer();
    this.searchTimer = setTimeout(() => void this.store.load(), 300);
  }

  submitSearch(): void {
    this.cancelSearchTimer();
    void this.store.load();
  }

  async sendReply(): Promise<void> {
    const content = this.reply();
    if (!content.trim()) return;
    this.reply.set('');
    const files = this.selectedFiles();
    const sent = files.length > 0
      ? await this.store.sendAttachments(files, content)
      : await this.store.sendReply(content);
    if (sent) this.selectedFiles.set([]);
    if (!sent) this.reply.set(content);
  }

  selectFiles(event: FileUploadHandlerEvent, uploader: FileUpload): void {
    const files = event.files.slice(0, 20);
    const allowed = files.filter((file) => isAllowedAttachment(file));
    this.selectedFiles.set(allowed);
    this.attachmentError.set(
      files.length !== event.files.length || allowed.length !== files.length
        ? 'Puedes adjuntar hasta 20 archivos PDF, imágenes o audios de máximo 7 MiB cada uno.'
        : '',
    );
    uploader.clear();
  }

  removeFile(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, current) => current !== index));
    this.attachmentError.set('');
  }

  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      await this.finishRecording();
      return;
    }
    this.attachmentError.set('');
    try {
      await this.audioRecorder.start();
      this.recording.set(true);
      this.recordingSeconds.set(0);
      this.recordingTimer = setInterval(() => this.recordingSeconds.update((value) => value + 1), 1_000);
    } catch {
      this.attachmentError.set('No fue posible acceder al micrófono o el navegador no admite grabación compatible.');
    }
  }

  private async finishRecording(): Promise<void> {
    this.stopRecordingTimer();
    this.recording.set(false);
    try {
      const file = await this.audioRecorder.stop();
      if (!isAllowedAttachment(file)) {
        this.attachmentError.set('El audio está vacío o supera el máximo de 7 MiB.');
        return;
      }
      this.selectedFiles.update((files) => [...files.slice(0, 19), file]);
    } catch {
      this.attachmentError.set('No fue posible finalizar la grabación de audio.');
    }
  }

  private cancelRecording(): void {
    this.stopRecordingTimer();
    this.recording.set(false);
    this.audioRecorder.cancel();
  }

  private stopRecordingTimer(): void {
    if (this.recordingTimer === null) return;
    clearInterval(this.recordingTimer);
    this.recordingTimer = null;
  }

  openAliasDialog(): void {
    this.alias.set(this.store.detail()?.conversation?.alias ?? '');
    this.aliasDialogVisible.set(true);
  }

  async saveAlias(): Promise<void> {
    if (await this.store.updateContact(this.alias())) this.aliasDialogVisible.set(false);
  }

  async confirmDelete(): Promise<void> {
    if (await this.store.deleteConversation()) this.deleteDialogVisible.set(false);
  }

  async confirmMarkAllRead(): Promise<void> {
    this.bulkDialogVisible.set(false);
    await this.store.markAllRead();
  }

  async confirmReactivateAgent(): Promise<void> {
    if (await this.store.reactivateAgent()) this.reactivateDialogVisible.set(false);
  }

  private cancelSearchTimer(): void {
    if (this.searchTimer === null) return;
    clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }
}

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/ogg', 'audio/webm',
]);

function isAllowedAttachment(file: File): boolean {
  return file.size > 0 && file.size <= 7 * 1024 * 1024 && ALLOWED_ATTACHMENT_TYPES.has(file.type);
}

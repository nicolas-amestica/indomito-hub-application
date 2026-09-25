import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ButtonDirective } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import type {
  DocumentPreviewOptions,
  PreviewDocument,
} from '../../interfaces/document-preview.interface';

@Component({
  selector: 'app-document-preview-dialog',
  imports: [ButtonDirective],
  templateUrl: './document-preview-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPreviewDialogComponent implements OnDestroy {
  private static readonly PDF_PRESENTATION = '#navpanes=0';
  private readonly config = inject(DynamicDialogConfig);
  private readonly ref = inject(DynamicDialogRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly blobUrls: string[] = [];

  protected readonly options = this.config.data as DocumentPreviewOptions;
  protected readonly activeIndex = signal(0);
  protected readonly confirming = signal(false);
  protected readonly sources = this.options.documents.map((document) => this.safeSource(document));
  protected readonly activeDocument = computed(() => this.options.documents[this.activeIndex()]);
  protected readonly activeSource = computed(() => this.sources[this.activeIndex()]);

  ngOnDestroy(): void {
    this.blobUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  protected select(index: number): void {
    this.activeIndex.set(index);
    this.confirming.set(false);
  }

  protected close(): void {
    this.ref.close({ action: 'close' });
  }

  protected download(): void {
    const document = this.activeDocument();
    const url = this.rawSource(document);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.name;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  }

  protected triggerPrimaryAction(): void {
    const action = this.options.primaryAction;
    if (!action) return;
    if (action.confirmationMessage && !this.confirming()) {
      this.confirming.set(true);
      return;
    }
    this.ref.close({ action: action.id });
  }

  private safeSource(document: PreviewDocument): SafeResourceUrl {
    const source = this.rawSource(document);
    const presentation =
      document.mimeType === 'application/pdf'
        ? `${source.split('#')[0]}${DocumentPreviewDialogComponent.PDF_PRESENTATION}`
        : source;
    return this.sanitizer.bypassSecurityTrustResourceUrl(presentation);
  }

  private rawSource(document: PreviewDocument): string {
    if (typeof document.source === 'string') return document.source;
    const existing = this.options.documents.indexOf(document);
    if (existing >= 0 && this.blobUrls[existing]) return this.blobUrls[existing];
    const url = URL.createObjectURL(document.source);
    if (existing >= 0) this.blobUrls[existing] = url;
    else this.blobUrls.push(url);
    return url;
  }
}

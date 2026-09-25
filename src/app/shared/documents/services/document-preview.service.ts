import { inject, Injectable } from '@angular/core';
import { DialogService, type DynamicDialogRef } from 'primeng/dynamicdialog';
import { DocumentPreviewDialogComponent } from '../components/document-preview-dialog/document-preview-dialog.component';
import type { DocumentPreviewOptions } from '../interfaces/document-preview.interface';

@Injectable({ providedIn: 'root' })
export class DocumentPreviewService {
  private readonly dialogs = inject(DialogService);

  open(options: DocumentPreviewOptions): DynamicDialogRef {
    return this.dialogs.open(DocumentPreviewDialogComponent, {
      data: options,
      modal: true,
      showHeader: false,
      closable: false,
      closeOnEscape: true,
      focusOnShow: false,
      dismissableMask: false,
      width: 'min(1200px, 96vw)',
      contentStyle: { padding: '0', overflow: 'hidden' },
      breakpoints: { '960px': '96vw', '640px': '100vw' },
    })!;
  }
}

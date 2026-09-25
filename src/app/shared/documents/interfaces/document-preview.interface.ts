import type { ButtonSeverity } from 'primeng/button';

export interface PreviewDocument {
  name: string;
  mimeType: string;
  source: Blob | string;
}

export interface DocumentPreviewAction {
  id: string;
  label: string;
  icon?: string;
  severity?: ButtonSeverity;
  confirmationMessage?: string;
}

export interface DocumentPreviewOptions {
  title?: string;
  description?: string;
  documents: PreviewDocument[];
  primaryAction?: DocumentPreviewAction;
}

export interface DocumentPreviewResult {
  action: string;
}

import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { BudgetRequest } from '../interfaces/program.interface';

const PDF_CONTENT_TYPE = 'application/pdf';
const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/gu;

/** Genera y descarga el presupuesto PDF del programa. */
@Injectable({ providedIn: 'root' })
export class BudgetPdfService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  /**
   * Solicita el documento binario al endpoint de presupuestos.
   *
   * La Lambda codifica el cuerpo en base64 para API Gateway; API Gateway y el
   * servidor local lo decodifican antes de entregarlo al navegador, por lo que
   * el cliente lo recibe correctamente como `Blob`.
   */
  generate(request: BudgetRequest): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/cotizaciones:presupuesto`, request, {
      responseType: 'blob',
    });
  }

  /** Descarga el blob recibido sin navegar ni recargar la aplicación. */
  download(blob: Blob, programName: string): void {
    const url = URL.createObjectURL(
      blob.type === PDF_CONTENT_TYPE ? blob : new Blob([blob], { type: PDF_CONTENT_TYPE }),
    );
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = buildBudgetPdfFileName(programName);
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

/** Deriva un nombre seguro y legible para el presupuesto descargado. */
export function buildBudgetPdfFileName(programName: string): string {
  const stem = programName
    .trim()
    .toLocaleLowerCase('es-CL')
    .replace(/\s+/gu, '_')
    .replace(INVALID_FILE_NAME_CHARS, '_')
    .replace(/_+/gu, '_')
    .replace(/^[. ]+|[. ]+$/gu, '');

  return `presupuesto_${stem || 'programa'}.pdf`;
}

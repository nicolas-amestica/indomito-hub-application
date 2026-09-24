import { Injectable } from '@angular/core';

import type { ExcelLayout } from './excel-layout';

/** Serializa y descarga el layout Excel sin incorporar el escritor al paquete inicial. */
@Injectable({ providedIn: 'root' })
export class ExcelExporter {
  /**
   * Genera el libro en un Web Worker y activa la descarga nativa del navegador.
   *
   * La importación dinámica apunta a la entrada de navegador publicada por
   * `write-excel-file` 4.x. Si la generación o la descarga falla, el rechazo se
   * propaga al container para que pueda notificarlo y rehabilitar sus acciones.
   */
  async export(layout: ExcelLayout): Promise<void> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const workbook = writeXlsxFile(layout.rows, {
      columns: layout.columns,
      sheet: layout.sheetName,
      showGridLines: false,
      stickyRowsCount: layout.stickyRowsCount,
    });

    await workbook.toFile(layout.fileName);
  }
}

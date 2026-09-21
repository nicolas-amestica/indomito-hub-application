import type { Program, SummaryRow } from '../interfaces/program.interface';

/** Valor que puede escribirse directamente en una celda del detalle exportado. */
export type ExcelCellValue = string | number | boolean | Date;

/** Constructor que declara el tipo OOXML de una celda sin depender del escritor de archivos. */
export type ExcelCellType =
  StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;

/** Celda neutral, compatible estructuralmente con `write-excel-file`. */
export interface ExcelCell {
  value?: ExcelCellValue;
  type?: ExcelCellType;
  format?: string;
  fontSize?: number;
  fontWeight?: 'bold';
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: 'thin' | 'medium' | 'double';
  bottomBorderColor?: string;
  bottomBorderStyle?: 'thin' | 'medium' | 'double';
  align?: 'left' | 'center' | 'right';
  alignVertical?: 'top' | 'center' | 'bottom';
  columnSpan?: number;
  wrap?: boolean;
}

/** Fila neutral del libro. */
export type ExcelRow = Array<ExcelCell | null>;

/** Ancho de una columna expresado en caracteres aproximados. */
export interface ExcelColumn {
  width: number;
}

/** Descripción completa del único libro que genera la exportación del programa. */
export interface ExcelLayout {
  rows: ExcelRow[];
  columns: ExcelColumn[];
  fileName: string;
  sheetName: string;
  stickyRowsCount: number;
}

/** Encabezados de la sección de detalle, en el mismo orden de `Summary_Table`. */
export const EXCEL_DETAIL_HEADERS = [
  'Nombre',
  'Tipo',
  'Moneda',
  'Tasa efectiva',
  'Precio unitario',
  'Monto base',
  'Monto en CLP',
] as const;

const SHEET_NAME = 'Programa';
const COLUMN_COUNT = EXCEL_DETAIL_HEADERS.length;
const MAX_FILE_STEM_LENGTH = 100;
const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/gu;
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

const COLORS = {
  navy: '#172554',
  blue: '#1D4ED8',
  lightBlue: '#DBEAFE',
  violet: '#6D28D9',
  lightViolet: '#EDE9FE',
  slate: '#475569',
  lightSlate: '#E2E8F0',
  white: '#FFFFFF',
} as const;

const CURRENCY_FORMAT = '#,##0.######';
const CLP_FORMAT = '#,##0';
const DATE_FORMAT = 'dd/mm/yyyy';

/**
 * Construye el layout de una hoja Excel sin cargar ni conocer la librería que la serializa.
 *
 * Las filas llegan separadas del programa para consumir siempre la colección completa del
 * cálculo. En particular, nunca recibe `visibleRows`, por lo que el filtro de la tabla no puede
 * eliminar ítems del archivo.
 *
 * @param program Programa completo que aporta encabezado y totales.
 * @param detailRows Todas las filas calculadas, sin filtro de búsqueda.
 * @param exportedAt Instante de exportación, inyectado para mantener esta función determinista.
 */
export function buildExcelLayout(
  program: Program,
  detailRows: readonly SummaryRow[],
  exportedAt: Date,
): ExcelLayout {
  const { exchange } = program.pricing;
  const effectiveUsd = exchange.usdToClp + program.pricing.usdIncreaseCLP;
  const effectiveBrl = exchange.brlToClp + program.pricing.brlIncreaseCLP;
  const headerRows = buildHeaderRows(program, exportedAt, effectiveUsd, effectiveBrl);
  const detailTitleIndex = headerRows.length;
  const rows: ExcelRow[] = [
    ...headerRows,
    sectionTitle('Detalle del programa', COLORS.blue),
    detailHeaderRow(),
    ...detailRows.map(detailRow),
    [],
    sectionTitle('Resumen', COLORS.violet),
    ...summaryRows(program),
  ];

  return {
    rows,
    columns: [
      { width: 32 },
      { width: 26 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 20 },
    ],
    fileName: buildExcelFileName(program.generals.name),
    sheetName: SHEET_NAME,
    stickyRowsCount: detailTitleIndex + 2,
  };
}

/**
 * Deriva un nombre de archivo seguro y estable desde el nombre visible del programa.
 *
 * Conserva letras acentuadas, convierte a minúsculas y reemplaza cada bloque de espacios por
 * un guion bajo. Los caracteres que los sistemas de archivos reservan se reemplazan también,
 * sin alterar la extensión `.xlsx`.
 */
export function buildExcelFileName(programName: string): string {
  const normalized = programName
    .trim()
    .toLocaleLowerCase('es-CL')
    .replace(/\s+/gu, '_')
    .replace(INVALID_FILE_NAME_CHARS, '_')
    .replace(/_+/gu, '_')
    .replace(/^[. ]+|[. ]+$/gu, '');
  const nonEmpty = normalized || 'programa';
  const safeStem = RESERVED_WINDOWS_NAMES.test(nonEmpty) ? `programa_${nonEmpty}` : nonEmpty;

  return `${safeStem.slice(0, MAX_FILE_STEM_LENGTH)}.xlsx`;
}

function buildHeaderRows(
  program: Program,
  exportedAt: Date,
  effectiveUsd: number,
  effectiveBrl: number,
): ExcelRow[] {
  const { generals, schedule, pricing } = program;

  return [
    [
      {
        value: generals.name,
        type: String,
        columnSpan: COLUMN_COUNT,
        fontSize: 18,
        fontWeight: 'bold',
        textColor: COLORS.white,
        backgroundColor: COLORS.navy,
        alignVertical: 'center',
      },
    ],
    metadataRow('Fecha de exportación', dateCell(exportedAt)),
    metadataRow('Plan', textCell(generals.plan.display)),
    metadataRow('Temporada', textCell(generals.season.display)),
    metadataRow('Destino', textCell(generals.destination.display)),
    metadataRow('Ciudad de salida', textCell(generals.departureCity)),
    metadataRow('Pasajeros', numberCell(schedule.totalPassengers, CLP_FORMAT)),
    metadataRow('Pasajeros liberados', numberCell(schedule.freePassengers, CLP_FORMAT)),
    metadataRow('Fecha de las tasas', isoDateCell(pricing.exchange.date)),
    metadataRow('Tasa del día USD', numberCell(pricing.exchange.usdToClp, CURRENCY_FORMAT)),
    metadataRow('Tasa efectiva USD', numberCell(effectiveUsd, CURRENCY_FORMAT)),
    metadataRow('Tasa del día BRL', numberCell(pricing.exchange.brlToClp, CURRENCY_FORMAT)),
    metadataRow('Tasa efectiva BRL', numberCell(effectiveBrl, CURRENCY_FORMAT)),
    [],
  ];
}

function metadataRow(label: string, value: ExcelCell): ExcelRow {
  return [
    {
      value: label,
      type: String,
      columnSpan: 2,
      fontWeight: 'bold',
      textColor: COLORS.slate,
      backgroundColor: COLORS.lightSlate,
    },
    { ...value, columnSpan: COLUMN_COUNT - 2 },
  ];
}

function sectionTitle(title: string, color: string): ExcelRow {
  return [
    {
      value: title,
      type: String,
      columnSpan: COLUMN_COUNT,
      fontSize: 13,
      fontWeight: 'bold',
      textColor: COLORS.white,
      backgroundColor: color,
    },
  ];
}

function detailHeaderRow(): ExcelRow {
  return EXCEL_DETAIL_HEADERS.map((header, index) => ({
    value: header,
    type: String,
    fontWeight: 'bold',
    textColor: COLORS.navy,
    backgroundColor: COLORS.lightBlue,
    bottomBorderColor: COLORS.blue,
    bottomBorderStyle: 'medium',
    align: index >= 3 ? 'right' : index === 2 ? 'center' : 'left',
    wrap: true,
  }));
}

function detailRow(row: SummaryRow): ExcelRow {
  const nativeAmountFormat = row.currency === 'CLP' ? CLP_FORMAT : CURRENCY_FORMAT;

  return [
    textCell(row.name),
    textCell(row.typeLabel),
    { ...textCell(row.currency), align: 'center' },
    { ...numberCell(row.effectiveRate, CURRENCY_FORMAT), align: 'right' },
    { ...numberCell(row.unitPrice, nativeAmountFormat), align: 'right' },
    { ...numberCell(row.baseAmount, nativeAmountFormat), align: 'right' },
    { ...numberCell(row.amountCLP, CLP_FORMAT), align: 'right', fontWeight: 'bold' },
  ];
}

function summaryRows(program: Program): ExcelRow[] {
  const totals = program.totals;
  const entries: ReadonlyArray<readonly [string, number, string]> = [
    ['Subtotal CLP', totals.subtotalCLP, CLP_FORMAT],
    ['Subtotal USD', totals.subtotalUSD, CURRENCY_FORMAT],
    ['Subtotal BRL', totals.subtotalBRL, CURRENCY_FORMAT],
    ['Neto', totals.netCLP, CLP_FORMAT],
    ['Utilidad', totals.utilityCLP, CLP_FORMAT],
    ['Neto con utilidad', totals.netWithUtilityCLP, CLP_FORMAT],
    ['Neto con utilidad por persona', totals.netWithUtilityPerPassengerCLP, CLP_FORMAT],
    ['Recargo', totals.rechargeCLP, CLP_FORMAT],
    ['Total programa', totals.totalCLP, CLP_FORMAT],
    ['Total por persona', totals.totalPerPassengerCLP, CLP_FORMAT],
  ];

  return entries.map(([label, value, format], index) => {
    const isTotal = index >= entries.length - 2;
    return [
      {
        value: label,
        type: String,
        columnSpan: 5,
        fontWeight: 'bold',
        backgroundColor: isTotal ? COLORS.lightViolet : undefined,
        bottomBorderColor: isTotal ? COLORS.violet : COLORS.lightSlate,
        bottomBorderStyle: isTotal ? 'medium' : 'thin',
      },
      {
        ...numberCell(value, format),
        columnSpan: 2,
        align: 'right',
        fontWeight: 'bold',
        backgroundColor: isTotal ? COLORS.lightViolet : undefined,
        bottomBorderColor: isTotal ? COLORS.violet : COLORS.lightSlate,
        bottomBorderStyle: isTotal ? 'medium' : 'thin',
      },
    ];
  });
}

function textCell(value: string): ExcelCell {
  return { value, type: String };
}

function numberCell(value: number, format: string): ExcelCell {
  return { value, type: Number, format };
}

function dateCell(value: Date): ExcelCell {
  return { value: new Date(value.getTime()), type: Date, format: DATE_FORMAT };
}

function isoDateCell(value: string): ExcelCell {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? textCell(value) : dateCell(date);
}

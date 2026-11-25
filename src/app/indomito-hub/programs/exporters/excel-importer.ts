import type { Worksheet } from 'exceljs';
import { CHARGE_TYPE_OPTIONS, CREW_TYPE_LABEL } from '../constants/charge-types';
import type { CatalogResponse } from '../interfaces/catalog.interface';
import type { CrewRowValue, ProgramFormValue, ServiceRowValue } from '../types/program-form.types';
import { EXCEL_DETAIL_HEADERS } from './excel-layout';

export interface ImportedProgram {
  generals: Partial<ProgramFormValue['generals']>;
  schedule: Partial<ProgramFormValue['schedule']>;
  pricing: Partial<ProgramFormValue['pricing']>;
  crews: Omit<CrewRowValue, 'id'>[];
  services: Omit<ServiceRowValue, 'id'>[];
}

function numeric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Valor numérico inválido');
  return value;
}

export function readProgramSheet(sheet: Worksheet, catalogs: CatalogResponse): ImportedProgram {
  const metadata = new Map<string, unknown>();
  let row = 2;
  const cell = (column: number) => sheet.getCell(row, column);
  while (row <= sheet.rowCount && cell(1).value !== 'Detalle del programa') {
    if (cell(1).value) metadata.set(cell(1).text, cell(3).value);
    row++;
  }
  row++;
  if (!EXCEL_DETAIL_HEADERS.every((value, i) => cell(i + 1).value === value))
    throw new Error('Detalle inválido');
  const option = <T extends { display: string }>(key: string, options: T[]) => {
    const matches = options.filter((item) => item.display === String(metadata.get(key)));
    if (matches.length !== 1) throw new Error('Catálogo desconocido');
    return matches[0];
  };
  const totalPassengers = numeric(metadata.get('Pasajeros'));
  const result: ImportedProgram = {
    generals: {
      name: sheet.getCell('A1').text,
      departureCity: String(metadata.get('Ciudad de salida') ?? ''),
      plan: option('Plan', catalogs.plans),
      season: option('Temporada', catalogs.seasons),
      destination: option('Destino', catalogs.destinations),
    },
    schedule: { totalPassengers, freePassengers: numeric(metadata.get('Pasajeros liberados')) },
    pricing: {
      usdIncreaseCLP:
        numeric(metadata.get('Tasa efectiva USD')) - numeric(metadata.get('Tasa del día USD')),
      brlIncreaseCLP:
        numeric(metadata.get('Tasa efectiva BRL')) - numeric(metadata.get('Tasa del día BRL')),
    },
    crews: [],
    services: [],
  };
  if (metadata.has('Descripción'))
    result.generals.description = String(metadata.get('Descripción') ?? '');
  for (row++; row <= sheet.rowCount && !(cell(1).value === 'Resumen' && cell(2).isMerged); row++) {
    if (!cell(1).value && !cell(2).value) continue;
    const name = cell(1).text;
    const type = cell(2).text;
    const currency = cell(3).value;
    if (!name || (currency !== 'USD' && currency !== 'BRL' && currency !== 'CLP'))
      throw new Error('Fila inválida');
    const unitPrice = numeric(cell(5).value);
    const base = numeric(cell(6).value);
    const charge = CHARGE_TYPE_OPTIONS.find((option) => option.label === type)?.value;
    if (type === CREW_TYPE_LABEL) {
      const documentId = String(
        metadata.get(`Documento tripulante ${result.crews.length + 1}`) ?? '',
      );
      result.crews.push({ name, documentId, currency, dailyPrice: unitPrice });
    } else if (charge) {
      result.services.push({ name, currency, chargeType: charge, unitPrice });
    } else throw new Error('Tipo de cobro inválido');
    if (unitPrice > 0) {
      const duration =
        base / unitPrice / (charge?.startsWith('per_passenger') ? totalPassengers : 1);
      const count = Math.round(duration);
      if (Math.abs(count - duration) < 0.000001) {
        if (type === CREW_TYPE_LABEL || charge === 'per_day' || charge === 'per_passenger_day')
          result.schedule.totalDays = count;
        if (charge === 'per_passenger_night') result.schedule.totalNights = count;
      }
    }
  }
  if (row > sheet.rowCount) throw new Error('Resumen ausente');
  const totals = new Map<string, unknown>();
  for (row++; row <= sheet.rowCount; row++) totals.set(cell(1).text, cell(6).value);
  if (!totals.has('Total programa')) throw new Error('Resumen incompleto');
  for (const [key, label, baseLabel, amountLabel] of [
    ['utilityRate', 'Utilidad (%)', 'Neto', 'Utilidad'],
    ['rechargeRate', 'Recargo (%)', 'Neto con utilidad', 'Recargo'],
  ] as const) {
    if (metadata.has(label)) result.pricing[key] = numeric(metadata.get(label));
    else {
      const base = numeric(totals.get(baseLabel));
      const amount = numeric(totals.get(amountLabel));
      if (base > 0) result.pricing[key] = Math.round((amount / base) * 10000) / 100;
    }
  }
  if (metadata.has('Días')) result.schedule.totalDays = numeric(metadata.get('Días'));
  if (metadata.has('Noches')) result.schedule.totalNights = numeric(metadata.get('Noches'));
  return result;
}

export async function importProgramExcel(
  file: File,
  catalogs: CatalogResponse,
): Promise<ImportedProgram> {
  const { default: excel } = await import('exceljs');
  const workbook = new excel.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet('Programa');
  if (!sheet) throw new Error('Hoja Programa ausente');
  return readProgramSheet(sheet, catalogs);
}

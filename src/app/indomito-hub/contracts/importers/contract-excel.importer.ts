import { Injectable } from '@angular/core';
import type ExcelJS from 'exceljs';
import type {
  ContractPassenger,
  ContractPassengerSex,
  ContractPerson,
} from '../interfaces/contract.interface';

export interface ContractPatch {
  institution?: { name?: string; address?: string; course?: string };
  trip?: { departurePoint?: string };
  clientRepresentatives?: ContractPerson[];
  passengers: ContractPassenger[];
}

const normalize = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const text = (value: unknown): string => String(value ?? '').trim();

@Injectable({ providedIn: 'root' })
export class ContractExcelImporter {
  async parse(file: File): Promise<ContractPatch> {
    const { default: ExcelJSRuntime } = await import('exceljs');
    const workbook = new ExcelJSRuntime.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.getWorksheet('Contrato') ?? workbook.worksheets[0];
    if (!sheet) throw new Error('El Excel no contiene una hoja utilizable.');

    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      rows[rowNumber - 1] = Array.from({ length: row.cellCount }, (_, index) =>
        this.cellValue(row.getCell(index + 1).value),
      );
    });

    const passengerHeader = rows.findIndex((row) =>
      this.hasHeaders(row, [
        'nombres',
        'apellidos',
        'rut',
        'fechanacimiento',
        'nacionalidad',
        'sexo',
      ]),
    );
    if (passengerHeader < 0) throw new Error('No se encontró la tabla de pasajeros requerida.');
    const passengers = this.table(rows, passengerHeader)
      .map((row): ContractPassenger => ({
        names: this.pick(row, ['nombres']),
        lastNames: this.pick(row, ['apellidos']),
        dni: this.pick(row, ['rut']),
        birthDate: this.date(this.pick(row, ['fechanacimiento'])),
        nationality: this.country(this.pick(row, ['nacionalidad'])),
        sex: this.sex(this.pick(row, ['sexo'])),
      }))
      .filter((row) => Object.values(row).some(Boolean));
    if (passengers.length === 0) throw new Error('El Excel debe contener al menos un pasajero.');
    const invalidPassenger = passengers.findIndex(
      (row) =>
        !row.names ||
        !row.lastNames ||
        !this.validRut(row.dni) ||
        !this.validBirthDate(row.birthDate) ||
        !row.nationality ||
        !row.sex,
    );
    if (invalidPassenger >= 0)
      throw new Error(
        `Revisa el pasajero ${invalidPassenger + 1}: todos sus datos, el RUT, la fecha de nacimiento y el sexo deben ser válidos.`,
      );

    const patch: ContractPatch = { passengers };
    const representativeHeader = rows.findIndex(
      (row) =>
        this.hasHeaders(row, ['nombres', 'apellidos', 'rut']) &&
        !this.hasHeaders(row, ['fechanacimiento', 'nacionalidad', 'sexo']),
    );
    if (representativeHeader >= 0) {
      const representatives = this.table(rows, representativeHeader)
        .map((row): ContractPerson => ({
          name: [this.pick(row, ['nombres']), this.pick(row, ['apellidos'])]
            .filter(Boolean)
            .join(' '),
          dni: this.pick(row, ['rut']),
          course: '',
        }))
        .filter((row) => row.name || row.dni);
      const invalidRepresentative = representatives.findIndex(
        (row) => !row.name || !this.validRut(row.dni),
      );
      if (invalidRepresentative >= 0)
        throw new Error(
          `Revisa el representante ${invalidRepresentative + 1}: el nombre, apellido y RUT son obligatorios.`,
        );
      if (representatives.length) patch.clientRepresentatives = representatives;
    }

    const labels = new Map<string, string>();
    for (const row of rows) {
      if (row && row.length >= 2 && text(row[0])) {
        labels.set(normalize(row[0]), text(row[1]));
      }
    }
    const name = this.label(labels, ['establecimientoeducacional']);
    const course = this.label(labels, ['curso']);
    const address = this.label(labels, ['direcciondesalidadelgrupo']);
    const departurePoint = this.label(labels, ['lugardesalidadelgrupo']);
    if (name || address || course) patch.institution = { name, address, course };
    if (departurePoint) patch.trip = { departurePoint };
    return patch;
  }

  private hasHeaders(row: unknown[] | undefined, expected: string[]): boolean {
    if (!row) return false;
    const headers = new Set(row.map(normalize));
    return expected.every((value) => headers.has(value));
  }
  private table(rows: unknown[][], headerIndex: number): Record<string, unknown>[] {
    const headers = rows[headerIndex].map(normalize);
    const result: Record<string, unknown>[] = [];
    for (const row of rows.slice(headerIndex + 1)) {
      if (!row || !row.some((cell) => text(cell))) break;
      result.push(Object.fromEntries(headers.map((header, index) => [header, row[index]])));
    }
    return result;
  }
  private pick(row: Record<string, unknown>, aliases: string[]): string {
    for (const alias of aliases) {
      const value = text(row[normalize(alias)]);
      if (value) return value;
    }
    return '';
  }
  private label(labels: Map<string, string>, aliases: string[]): string {
    for (const alias of aliases) {
      const value = labels.get(normalize(alias));
      if (value) return value;
    }
    return '';
  }
  private sex(value: string): ContractPassengerSex {
    const normalized = normalize(value);
    if (normalized === 'femenino') return 'FEMALE';
    if (normalized === 'masculino') return 'MALE';
    if (normalized === 'otro') return 'OTHER';
    if (normalized === 'prefierenoindicar') return 'NOT_SPECIFIED';
    return '' as ContractPassengerSex;
  }
  private country(value: string): string {
    const aliases: Record<string, string> = {
      chilena: 'Chile',
      chileno: 'Chile',
      argentina: 'Argentina',
      argentino: 'Argentina',
      brasilena: 'Brasil',
      brasileno: 'Brasil',
    };
    return aliases[normalize(value)] ?? value;
  }
  private date(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  }
  private validBirthDate(value: string): boolean {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return (
      date.getFullYear() === Number(match[1]) &&
      date.getMonth() === Number(match[2]) - 1 &&
      date.getDate() === Number(match[3]) &&
      date <= new Date() &&
      date.getFullYear() >= 1920
    );
  }
  private validRut(value: string): boolean {
    const cleaned = value.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
    const match = cleaned.match(/^(\d{7,8})-([0-9K])$/);
    if (!match) return false;
    let sum = 0;
    let factor = 2;
    for (let index = match[1].length - 1; index >= 0; index--) {
      sum += Number(match[1][index]) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }
    const result = 11 - (sum % 11);
    const expected = result === 11 ? '0' : result === 10 ? 'K' : String(result);
    return expected === match[2];
  }
  private cellValue(value: ExcelJS.CellValue): unknown {
    if (value instanceof Date) {
      const day = String(value.getUTCDate()).padStart(2, '0');
      const month = String(value.getUTCMonth() + 1).padStart(2, '0');
      return `${value.getUTCFullYear()}-${month}-${day}`;
    }
    if (typeof value === 'object' && value !== null && 'text' in value) return value.text;
    if (typeof value === 'object' && value !== null && 'result' in value) return value.result;
    return value ?? '';
  }
}

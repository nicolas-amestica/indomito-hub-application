import { Injectable } from '@angular/core';
import type ExcelJS from 'exceljs';
import type { ContractContent, ContractPassenger, ContractPerson } from '../interfaces/contract.interface';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type ContractPatch = DeepPartial<Omit<ContractContent, 'passengers'>> & { passengers: ContractPassenger[] };
const normalize = (value: unknown): string => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
      rows[rowNumber - 1] = Array.from({ length: row.cellCount }, (_, index) => this.cellValue(row.getCell(index + 1).value));
    });
    const passengerHeader = rows.findIndex((row) => this.hasHeaders(row, ['nombres', 'apellidos', 'rut', 'fechanacimiento', 'nacionalidad']));
    if (passengerHeader < 0) throw new Error('No se encontró la tabla de pasajeros requerida.');
    const passengers = this.table(rows, passengerHeader).map((row) => ({ names: this.pick(row, ['nombres', 'nombre']), lastNames: this.pick(row, ['apellidos', 'apellido']), dni: this.pick(row, ['rut', 'dni']), birthDate: this.pick(row, ['fechanacimiento', 'nacimiento']), nationality: this.pick(row, ['nacionalidad']) })).filter((row) => Object.values(row).some(Boolean));
    if (passengers.length === 0) throw new Error('El Excel debe contener al menos un pasajero.');
    const invalidPassenger = passengers.findIndex((row) => !row.names || !row.lastNames || !this.validRut(row.dni) || !this.validBirthDate(row.birthDate) || !row.nationality);
    if (invalidPassenger >= 0) throw new Error(`Revisa el pasajero ${invalidPassenger + 1}: todos sus datos, el RUT y la fecha de nacimiento deben ser válidos.`);
    const patch: ContractPatch = { passengers };
    const representativeHeader = rows.findIndex((row) => this.hasHeaders(row, ['nombre', 'rut']) && !this.hasHeaders(row, ['nombres', 'apellidos', 'fechanacimiento']));
    if (representativeHeader >= 0) {
      const representatives: ContractPerson[] = this.table(rows, representativeHeader).map((row) => ({ name: [this.pick(row, ['nombre']), this.pick(row, ['apellido'])].filter(Boolean).join(' '), dni: this.pick(row, ['rut', 'dni']), course: this.pick(row, ['curso']) })).filter((row) => row.name || row.dni);
      const invalidRepresentative = representatives.findIndex((row) => row.dni && !this.validRut(row.dni));
      if (invalidRepresentative >= 0) throw new Error(`El RUT del representante ${invalidRepresentative + 1} no es válido.`);
      if (representatives.length) patch.clientRepresentatives = representatives;
    }
    const labels = new Map<string, string>();
    for (const row of rows) if (row.length >= 2 && text(row[0])) labels.set(normalize(row[0]), text(row[1]));
    const institutionName = this.label(labels, ['establecimientoeducacional', 'institucion', 'colegio']);
    const departurePoint = this.label(labels, ['lugardesalidadelgrupo', 'puntodesalida']);
    const address = this.label(labels, ['direcciondesalidadelgrupo', 'direccion']);
    const planName = this.label(labels, ['nombredelprogramaacontratar', 'programa', 'plan']);
    if (institutionName || address) patch.institution = { name: institutionName, address };
    const trip: Record<string, string | number> = {};
    this.assignText(trip, 'city', labels, ['ciudaddefirma']); this.assignText(trip, 'contractDate', labels, ['fechadelcontrato']); this.assignText(trip, 'destination', labels, ['destino']); this.assignText(trip, 'departureDate', labels, ['fechadesalida']); this.assignText(trip, 'returnDate', labels, ['fechaderetorno']); if (departurePoint) trip['departurePoint'] = departurePoint; this.assignNumber(trip, 'days', labels, ['dias']); this.assignNumber(trip, 'nights', labels, ['noches']);
    if (Object.keys(trip).length) patch.trip = trip;
    if (planName) patch.plan = { name: planName, servicesIncluded: [] };
    const payments: Record<string, unknown> = { totalPassengers: passengers.length }; const installments: Record<string, string | number> = {}; const conditions: Record<string, number> = {}; const bankAccount: Record<string, string> = {};
    this.assignNumber(payments, 'freePassengers', labels, ['pasajerosliberados']); this.assignNumber(payments, 'pricePerPerson', labels, ['precioporpersonaclp']); this.assignNumber(payments, 'priceInUSD', labels, ['precioporpersonausd']); this.assignNumber(payments, 'totalGroup', labels, ['totalgrupoclp']); this.assignNumber(payments, 'downPayment', labels, ['abonoinicialgrupalclp']); this.assignNumber(payments, 'groupBalance', labels, ['saldogrupalclp']); this.assignNumber(payments, 'daysBeforePayment', labels, ['diasantesdelpago']); this.assignNumber(payments, 'maxExchangeRate', labels, ['tipodecambiotopeusd']);
    this.assignNumber(installments, 'quantity', labels, ['cantidaddecuotas']); this.assignNumber(installments, 'groupInstallmentValue', labels, ['valorcuotagrupalclp']); this.assignNumber(installments, 'individualInstallmentValue', labels, ['valorcuotaindividualclp']); this.assignText(installments, 'startMonth', labels, ['mesdeiniciodecuotas']);
    this.assignNumber(conditions, 'depositPercentageWithFlight', labels, ['abonoconpasajes']); this.assignNumber(conditions, 'depositPercentageWithoutFlight', labels, ['abonosinpasajes']); this.assignNumber(conditions, 'specialProgramDeposit', labels, ['abonoprogramaespecialclp']); this.assignNumber(conditions, 'daysBeforeFlightBalance', labels, ['diasantessaldoaereo']); this.assignNumber(conditions, 'daysBeforeTerrestrialBalance', labels, ['diasantessaldoterrestre']); this.assignNumber(conditions, 'cancellationPenaltyPercentage', labels, ['penalidadcancelacion']); this.assignNumber(conditions, 'cancellationNoticeDays', labels, ['diasavisocancelacion']); this.assignNumber(conditions, 'complaintDeadlineDays', labels, ['diasplazoreclamos']);
    this.assignText(bankAccount, 'accountNumber', labels, ['numerodecuenta']); this.assignText(bankAccount, 'accountHolder', labels, ['titularencuenta', 'titular']); this.assignText(bankAccount, 'holderDNI', labels, ['ruttitulardecuenta']); this.assignText(bankAccount, 'bank', labels, ['banco']); this.assignText(bankAccount, 'email', labels, ['emaildecomprobantes']);
    if (Object.keys(installments).length) payments['installments'] = installments; if (Object.keys(conditions).length) payments['conditions'] = conditions; if (Object.keys(bankAccount).length) payments['bankAccount'] = bankAccount; patch.payments = payments;
    return patch;
  }
  private hasHeaders(row: unknown[], expected: string[]): boolean { const headers = new Set(row.map(normalize)); return expected.every((value) => headers.has(value)); }
  private table(rows: unknown[][], headerIndex: number): Record<string, unknown>[] { const headers = rows[headerIndex].map(normalize); const result: Record<string, unknown>[] = []; for (const row of rows.slice(headerIndex + 1)) { if (!row.some((cell) => text(cell))) break; result.push(Object.fromEntries(headers.map((header, index) => [header, row[index]]))); } return result; }
  private pick(row: Record<string, unknown>, aliases: string[]): string { for (const alias of aliases) { const value = text(row[normalize(alias)]); if (value) return value; } return ''; }
  private label(labels: Map<string, string>, aliases: string[]): string { for (const alias of aliases) { const value = labels.get(normalize(alias)); if (value) return value; } return ''; }
  private assignText(target: Record<string, unknown>, key: string, labels: Map<string, string>, aliases: string[]): void { const value = this.label(labels, aliases); if (value) target[key] = value; }
  private assignNumber(target: Record<string, unknown>, key: string, labels: Map<string, string>, aliases: string[]): void { const raw = this.label(labels, aliases); if (!raw) return; const value = Number(raw.replace(/[^0-9,.-]/g, '').replace(',', '.')); if (Number.isFinite(value)) target[key] = value; }
  private validBirthDate(value: string): boolean { const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/); if (!match) return false; const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])); return date.getFullYear() === Number(match[3]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1]) && date <= new Date() && date.getFullYear() >= 1920; }
  private validRut(value: string): boolean { const cleaned = value.replace(/\./g, '').replace(/\s/g, '').toUpperCase(); const match = cleaned.match(/^(\d{7,8})-([0-9K])$/); if (!match) return false; let sum = 0; let factor = 2; for (let index = match[1].length - 1; index >= 0; index--) { sum += Number(match[1][index]) * factor; factor = factor === 7 ? 2 : factor + 1; } const result = 11 - (sum % 11); const expected = result === 11 ? '0' : result === 10 ? 'K' : String(result); return expected === match[2]; }
  private cellValue(value: ExcelJS.CellValue): unknown {
    if (value instanceof Date) return value.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (typeof value === 'object' && value !== null && 'text' in value) return value.text;
    if (typeof value === 'object' && value !== null && 'result' in value) return value.result;
    return value ?? '';
  }
}

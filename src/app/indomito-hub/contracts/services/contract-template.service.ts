import { Injectable } from '@angular/core';
import type ExcelJS from 'exceljs';
import type { ContractCountryOption } from '../interfaces/contract.interface';

const PASSENGER_CAPACITY = 200;
const PERSON_CAPACITY = 8;
const SHEET_PASSWORD = 'indomito-template';

@Injectable({ providedIn: 'root' })
export class ContractTemplateService {
  async download(countries: ContractCountryOption[]): Promise<void> {
    const buffer = await this.build(countries);
    const blob = new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'plantilla-creacion-contrato.xlsx';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async build(countries: ContractCountryOption[]): Promise<ExcelJS.Buffer> {
    const { default: ExcelJSRuntime } = await import('exceljs');
    const workbook = new ExcelJSRuntime.Workbook();
    workbook.creator = 'Giras Indómito';
    workbook.title = 'Plantilla de creación de contrato';
    workbook.created = new Date();
    const lists = workbook.addWorksheet('_listas', { state: 'veryHidden' });
    lists.getCell('A1').value = 'Países';
    countries.forEach((country, index) => {
      lists.getCell(index + 2, 1).value = country.name;
    });
    await lists.protect(SHEET_PASSWORD, {});
    const sheet = workbook.addWorksheet('Contrato', {
      views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    });
    sheet.columns = [
      { key: 'a', width: 30 },
      { key: 'b', width: 26 },
      { key: 'c', width: 24 },
      { key: 'd', width: 24 },
      { key: 'e', width: 22 },
      { key: 'f', width: 24 },
    ];
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = 'Plantilla de creación de contrato';
    sheet.getCell('A1').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF172033' } };
    sheet.getCell('A2').value =
      'Complete solo las celdas amarillas. La nómina de pasajeros es obligatoria.';
    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').font = {
      name: 'Arial',
      size: 10,
      italic: true,
      color: { argb: 'FF5B6474' },
    };

    let row = 4;
    const scalarFields: Array<[string, 'text']> = [
      ['DATOS DEL ESTABLECIMIENTO', 'text'],
      ['Establecimiento educacional', 'text'],
      ['Curso', 'text'],
      ['Lugar de salida del grupo', 'text'],
      ['Dirección de salida del grupo', 'text'],
    ];
    this.section(sheet, row++, scalarFields[0][0]);
    for (const [label, kind] of scalarFields.slice(1)) {
      sheet.getCell(row, 1).value = label;
      sheet.getCell(row, 1).font = { name: 'Arial', size: 10 };
      const cell = sheet.getCell(row, 2);
      this.input(cell);
      this.validation(cell, kind);
      row += 1;
    }
    row += 1;
    const clientStart = this.peopleTable(
      sheet,
      row,
      'REPRESENTANTES QUE FIRMARÁN EL CONTRATO',
      PERSON_CAPACITY,
    );
    row = clientStart.end + 2;
    this.section(sheet, row++, 'NÓMINA DE PASAJEROS (OBLIGATORIA)');
    sheet.mergeCells(row, 1, row, 6);
    sheet.getCell(row, 1).value =
      'Incluya a toda persona que viajará: estudiantes, apoderados, profesores y acompañantes.';
    sheet.getCell(row, 1).font = { bold: true, color: { argb: 'FF9C2E18' } };
    row += 1;
    this.headers(sheet, row, [
      'Nombres',
      'Apellidos',
      'RUT',
      'Fecha nacimiento',
      'Nacionalidad',
      'Sexo',
    ]);
    const passengerHeader = row;
    const passengerStart = ++row;
    for (let i = 0; i < PASSENGER_CAPACITY; i++, row++) {
      for (let col = 1; col <= 6; col++) this.input(sheet.getCell(row, col));
      this.rutValidation(sheet.getCell(row, 3));
      const birth = sheet.getCell(row, 4);
      birth.numFmt = 'dd/mm/yyyy';
      birth.dataValidation = {
        type: 'date',
        operator: 'between',
        allowBlank: true,
        formulae: [new Date(1920, 0, 1), new Date()],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Fecha inválida',
        error: 'Ingrese una fecha real entre 01/01/1920 y hoy.',
      };
      sheet.getCell(row, 5).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`'_listas'!$A$2:$A$${countries.length + 1}`],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Nacionalidad inválida',
        error: 'Seleccione una opción de la lista.',
      };
      sheet.getCell(row, 6).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Femenino,Masculino,Otro,Prefiere no indicar"'],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Sexo inválido',
        error: 'Seleccione una opción de la lista.',
      };
    }
    sheet.autoFilter = {
      from: { row: passengerHeader, column: 1 },
      to: { row: passengerHeader + PASSENGER_CAPACITY, column: 6 },
    };
    await sheet.protect(SHEET_PASSWORD, {
      selectLockedCells: false,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertRows: false,
      insertColumns: false,
      deleteRows: false,
      deleteColumns: false,
      sort: false,
      autoFilter: true,
    });

    const meta = workbook.addWorksheet('_import', { state: 'veryHidden' });
    const metadata: Array<[string, string | number]> = [
      ['schema_version', 2],
      ['sheet', 'Contrato'],
      ['client_header_row', clientStart.header],
      ['client_start_row', clientStart.start],
      ['client_end_row', clientStart.end],
      ['passengers_header_row', passengerHeader],
      ['passengers_start_row', passengerStart],
      ['passengers_end_row', passengerStart + PASSENGER_CAPACITY - 1],
    ];
    metadata.forEach(([key, value], index) => {
      meta.getCell(index + 1, 1).value = key;
      meta.getCell(index + 1, 2).value = value;
    });
    await meta.protect(SHEET_PASSWORD, {});
    return workbook.xlsx.writeBuffer();
  }

  private peopleTable(
    sheet: ExcelJS.Worksheet,
    start: number,
    title: string,
    capacity: number,
  ): { header: number; start: number; end: number } {
    this.section(sheet, start++, title);
    const headers = ['Nombres', 'Apellidos', 'RUT'];
    this.headers(sheet, start, headers);
    const header = start;
    const dataStart = ++start;
    for (let i = 0; i < capacity; i++, start++) {
      for (let col = 1; col <= headers.length; col++) this.input(sheet.getCell(start, col));
      this.rutValidation(sheet.getCell(start, 3));
    }
    return { header, start: dataStart, end: start - 1 };
  }
  private section(sheet: ExcelJS.Worksheet, row: number, title: string): void {
    sheet.mergeCells(row, 1, row, 6);
    const cell = sheet.getCell(row, 1);
    cell.value = title;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172033' } };
  }
  private headers(sheet: ExcelJS.Worksheet, row: number, labels: string[]): void {
    labels.forEach((label, index) => {
      const cell = sheet.getCell(row, index + 1);
      cell.value = label;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF35607A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }
  private input(cell: ExcelJS.Cell): void {
    cell.protection = { locked: false };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD6C37A' } } };
    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF172033' } };
  }
  private validation(cell: ExcelJS.Cell, kind: string): void {
    if (kind === 'date') {
      cell.numFmt = 'dd/mm/yyyy';
      cell.dataValidation = {
        type: 'date',
        operator: 'between',
        allowBlank: true,
        formulae: [new Date(2020, 0, 1), new Date(2100, 11, 31)],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Fecha inválida',
        error: 'Ingrese una fecha real.',
      };
    } else if (kind === 'integer' || kind === 'money')
      cell.dataValidation = {
        type: 'whole',
        operator: 'greaterThanOrEqual',
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Valor inválido',
        error: 'Ingrese un número entero mayor o igual a cero.',
      };
    else if (kind === 'percent')
      cell.dataValidation = {
        type: 'whole',
        operator: 'between',
        allowBlank: true,
        formulae: [0, 100],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Porcentaje inválido',
        error: 'Ingrese un porcentaje entre 0 y 100.',
      };
  }
  private rutValidation(cell: ExcelJS.Cell): void {
    const a = cell.address;
    cell.numFmt = '@';
    cell.dataValidation = {
      type: 'custom',
      allowBlank: true,
      formulae: [
        `AND(ISERROR(SEARCH(".",${a})),ISERROR(SEARCH(" ",${a})),LEN(${a})>=9,LEN(${a})<=10,LEN(${a})-LEN(SUBSTITUTE(${a},"-",""))=1,ISNUMBER(VALUE(LEFT(${a},FIND("-",${a})-1))),OR(ISNUMBER(VALUE(RIGHT(${a},1))),UPPER(RIGHT(${a},1))="K"))`,
      ],
      showInputMessage: true,
      promptTitle: 'RUT chileno',
      prompt: 'Sin puntos y con guion. Ejemplo: 12345678-9',
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'RUT inválido',
      error: 'Use RUT sin puntos y con guion.',
    };
  }
}

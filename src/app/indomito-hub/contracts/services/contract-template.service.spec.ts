import ExcelJS from 'exceljs';
import { ContractTemplateService } from './contract-template.service';

describe('ContractTemplateService', () => {
  it('builds a protected template with validations and hidden import metadata', async () => {
    const buffer = await new ContractTemplateService().build([
      { code: 'CL', name: 'Chile' },
      { code: 'AR', name: 'Argentina' },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Contrato');
    const metadata = workbook.getWorksheet('_import');
    const lists = workbook.getWorksheet('_listas');
    expect(sheet).toBeDefined();
    expect(
      (sheet as unknown as { sheetProtection?: { sheet: boolean } }).sheetProtection?.sheet,
    ).toBe(true);
    expect(metadata?.state).toBe('veryHidden');
    expect(lists?.state).toBe('veryHidden');
    expect(lists?.getCell('A2').value).toBe('Chile');
    let passengerHeaderRow = 0;
    sheet?.eachRow((row) => {
      if (row.getCell(1).value === 'Nombres') passengerHeaderRow = row.number;
    });
    expect(passengerHeaderRow).toBeGreaterThan(0);
    const firstPassengerRow = passengerHeaderRow + 1;
    expect(sheet?.getCell(firstPassengerRow, 3).dataValidation.type).toBe('custom');
    expect(sheet?.getCell(firstPassengerRow, 4).dataValidation.type).toBe('date');
    expect(sheet?.getCell(firstPassengerRow, 5).dataValidation.formulae).toEqual([
      "'_listas'!$A$2:$A$3",
    ]);
    expect(sheet?.getCell(firstPassengerRow, 6).dataValidation.type).toBe('list');
    expect(sheet?.getCell(firstPassengerRow, 1).protection.locked).toBe(false);
    const visibleText: string[] = [];
    sheet?.eachRow((row) => row.eachCell((cell) => visibleText.push(String(cell.value ?? ''))));
    expect(visibleText).toContain('REPRESENTANTES QUE FIRMARÁN EL CONTRATO');
    expect(visibleText).toContain('Curso');
    expect(visibleText).toContain('Sexo');
    expect(visibleText).not.toContain('Precio por persona CLP');
    expect(visibleText).not.toContain('Número de cuenta');
  });
});

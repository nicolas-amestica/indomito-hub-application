import ExcelJS from 'exceljs';
import { ContractTemplateService } from './contract-template.service';

describe('ContractTemplateService', () => {
  it('builds a protected template with validations and hidden import metadata', async () => {
    const buffer = await new ContractTemplateService().build();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Contrato');
    const metadata = workbook.getWorksheet('_import');
    expect(sheet).toBeDefined();
    expect((sheet as unknown as { sheetProtection?: { sheet: boolean } }).sheetProtection?.sheet).toBe(true);
    expect(metadata?.state).toBe('veryHidden');
    let passengerHeaderRow = 0;
    sheet?.eachRow((row) => { if (row.getCell(1).value === 'Nombres') passengerHeaderRow = row.number; });
    expect(passengerHeaderRow).toBeGreaterThan(0);
    const firstPassengerRow = passengerHeaderRow + 1;
    expect(sheet?.getCell(firstPassengerRow, 3).dataValidation.type).toBe('custom');
    expect(sheet?.getCell(firstPassengerRow, 4).dataValidation.type).toBe('date');
    expect(sheet?.getCell(firstPassengerRow, 1).protection.locked).toBe(false);
  });
});

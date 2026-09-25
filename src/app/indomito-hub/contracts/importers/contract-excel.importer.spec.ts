import ExcelJS from 'exceljs';
import { ContractTemplateService } from '../services/contract-template.service';
import { ContractExcelImporter } from './contract-excel.importer';

describe('ContractExcelImporter', () => {
  it('importa la plantilla aunque existan filas vacías entre sus secciones', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await new ContractTemplateService().build([
        { code: 'CL', name: 'Chile' },
        { code: 'AR', name: 'Argentina' },
      ]),
    );
    const sheet = workbook.getWorksheet('Contrato');
    expect(sheet).toBeDefined();
    sheet!.getCell('B5').value = 'Colegio San Francisco';
    sheet!.getCell('B6').value = '4° Medio B';
    sheet!.getCell('B7').value = 'Entrada principal';
    sheet!.getCell('B8').value = 'Calle Montt 666';
    sheet!.getCell('A12').value = 'Pedro';
    sheet!.getCell('B12').value = 'Aguilera';
    sheet!.getCell('C12').value = '16915292-6';
    sheet!.getCell('A24').value = 'María José';
    sheet!.getCell('B24').value = 'Améstica Vidal';
    sheet!.getCell('C24').value = '16663901-8';
    sheet!.getCell('D24').value = new Date(1988, 1, 11);
    sheet!.getCell('E24').value = 'Chilena';
    sheet!.getCell('F24').value = 'Femenino';
    const bytes = await workbook.xlsx.writeBuffer();
    const file = { arrayBuffer: async () => bytes } as File;

    const patch = await new ContractExcelImporter().parse(file);

    expect(patch.institution).toEqual({
      name: 'Colegio San Francisco',
      course: '4° Medio B',
      address: 'Calle Montt 666',
    });
    expect(patch.trip).toEqual({ departurePoint: 'Entrada principal' });
    expect(patch.clientRepresentatives).toEqual([
      { name: 'Pedro Aguilera', dni: '16915292-6', course: '' },
    ]);
    expect(patch.passengers).toEqual([
      {
        names: 'María José',
        lastNames: 'Améstica Vidal',
        dni: '16663901-8',
        birthDate: '1988-02-11',
        nationality: 'Chile',
        sex: 'FEMALE',
      },
    ]);
  });
});

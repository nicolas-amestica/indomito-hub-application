import type { ExcelLayout } from './excel-layout';
import { ExcelExporter } from './excel-exporter';

const { toFile, writeXlsxFile } = vi.hoisted(() => ({
  toFile: vi.fn(),
  writeXlsxFile: vi.fn(),
}));

vi.mock('write-excel-file/browser', () => ({ default: writeXlsxFile }));

const LAYOUT: ExcelLayout = {
  rows: [[{ value: 'Programa', type: String }]],
  columns: [{ width: 24 }],
  fileName: 'programa.xlsx',
  sheetName: 'Programa',
  stickyRowsCount: 1,
};

describe('ExcelExporter', () => {
  beforeEach(() => {
    toFile.mockReset().mockResolvedValue(undefined);
    writeXlsxFile.mockReset().mockReturnValue({ toFile });
  });

  it('serializa una sola hoja y descarga el archivo indicado por el layout', async () => {
    await new ExcelExporter().export(LAYOUT);

    expect(writeXlsxFile).toHaveBeenCalledOnce();
    expect(writeXlsxFile).toHaveBeenCalledWith(LAYOUT.rows, {
      columns: LAYOUT.columns,
      sheet: 'Programa',
      showGridLines: false,
      stickyRowsCount: 1,
    });
    expect(toFile).toHaveBeenCalledWith('programa.xlsx');
  });

  it('propaga el error de descarga al container', async () => {
    toFile.mockRejectedValueOnce(new Error('download failed'));

    await expect(new ExcelExporter().export(LAYOUT)).rejects.toThrow('download failed');
  });
});

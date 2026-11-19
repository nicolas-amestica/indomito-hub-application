import type { BalanceBudget } from '../interfaces/balance.interface';
import type { balanceTableRow } from './balance-table';
import { BALANCE_COLUMNS } from '../constants/balance-columns';
import { calculateBalance } from './calculate-balance';

/** Exporta resultados calculados y sus fórmulas, filtros y escenario; Excel no ejecuta la aplicación. */
export async function exportBalance(
  rows: ReturnType<typeof balanceTableRow>[],
  budget: BalanceBudget | null,
  context: Record<string, string>,
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  book.creator = 'Indómito Hub';
  const info = book.addWorksheet('Alcance');
  for (const [key, value] of Object.entries(context)) info.addRow([key, value]);
  info.addRow(['Datos ausentes', 'Sin datos; nunca cero por falta de información']);
  info.addRow([
    'Resultado operativo estimado',
    'Venta neta simulada − costo neto; no es utilidad neta ni movimiento bancario',
  ]);
  info.addRow(['Margen sobre venta', 'Resultado operativo / venta neta × 100']);
  info.addRow(['Recargo sobre costo', 'Resultado operativo / costo neto × 100']);
  info.addRow(['Pendiente proveedores', 'max(0, compromiso − pagado + recuperación recibida)']);
  info.columns = [{ width: 34 }, { width: 100 }];
  const table = book.addWorksheet('Viajes');
  table.addRow(
    BALANCE_COLUMNS.map((column) => `${column.label}${column.unit ? ` (${column.unit})` : ''}`),
  );
  for (const row of rows)
    table.addRow(BALANCE_COLUMNS.map((column) => row[column.field] ?? 'Sin datos'));
  table.views = [{ state: 'frozen', ySplit: 1 }];
  table.autoFilter = { from: 'A1', to: { row: rows.length + 1, column: BALANCE_COLUMNS.length } };
  table.columns.forEach((column) => {
    column.width = 25;
  });
  if (budget) {
    const calc = calculateBalance(budget);
    const sheet = book.addWorksheet('Escenario seleccionado');
    const values: [string, string | number | null][] = [
      ['Nombre', budget.name],
      ['Procedencia', `${budget.source.kind} ${budget.source.id} ${budget.source.version}`],
      ['Pagantes', calc.paying],
      ['Precio bruto CLP por pagante', budget.pricePerPayer],
      ['Descuento %', budget.discount],
      ['IVA %', budget.taxes.vatRate],
      ['Venta bruta CLP', calc.grossSale],
      ['Venta neta CLP', calc.netSale],
      ['Costo neto CLP', calc.cost],
      ['Resultado neto estimado CLP', calc.result],
      ['Margen sobre venta neta %', calc.margin],
    ];
    values.forEach((row) => sheet.addRow(row.map((value) => value ?? 'Sin datos')));
    if (calc.cost !== null) {
      sheet.getCell('B7').value = { formula: 'ROUND(B3*B4*(1-B5/100),0)', result: calc.grossSale };
      sheet.getCell('B8').value = { formula: 'ROUND(B7/(1+B6/100),0)', result: calc.netSale };
      sheet.getCell('B10').value = { formula: 'B8-B9', result: calc.result! };
      if (calc.margin !== null)
        sheet.getCell('B11').value = { formula: 'B10/B8*100', result: calc.margin };
    }
    sheet.addRow([]);
    sheet.addRow([
      'Descripción',
      'Categoría',
      'Moneda',
      'Precio unitario',
      'Tasa',
      'Resguardo',
      'Base',
      'Cantidad',
      'Días',
      'Noches',
      'Estado',
      'Costo CLP neto',
      'Fuente tasa',
      'Fecha tasa',
    ]);
    for (const line of budget.lines)
      sheet.addRow([
        line.description,
        budget.categories.find((category) => category.id === line.categoryId)?.name ?? '',
        line.currency,
        line.unitPrice,
        line.rate,
        line.buffer,
        line.basis,
        line.quantity,
        line.days,
        line.nights,
        line.state,
        calc.rows.find((row) => row.id === line.id)?.amount ?? 'Sin datos',
        line.rateSource,
        line.rateDate,
      ]);
    sheet.columns.forEach((column) => {
      column.width = 25;
    });
  }
  const data = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(data)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `detalle-balance-${context['Período documental'] ?? ''}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

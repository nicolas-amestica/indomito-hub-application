import { describe, expect, it } from 'vitest';
import { balanceDetailFixture } from './__fixtures__/balance.fixture';
import { buildBalanceCharts } from './build-balance-charts';

describe('Gráficos con fuente y alcance', () => {
  it('crea 17 gráficos y un mapa de calor independiente sin claves duplicadas', () => {
    const detail = balanceDetailFixture();
    detail.row.finance = {
      position: {
        receivable: 0,
        depositReceivable: 0,
        installmentReceivable: 0,
        appliedReceipts: 0,
        unappliedReceipts: 0,
        discounts: 0,
        cancelled: 0,
        refundPayable: 0,
        refunded: 0,
      },
      overdue: 0,
      aging: [0, 0, 0, 0],
      suppliers: [],
      cashDays: [],
      opening: 0,
      closing: 0,
      inflows: 0,
      outflows: 0,
      actualFees: 0,
      scheduled: [],
      activePassengers: 32,
      freePassengers: 2,
      historyComplete: false,
      receiptHistory: [],
    };
    const charts = buildBalanceCharts(
      [detail.row],
      detail.row,
      detail.row.state.current,
      { text: 'black', grid: 'gray', colors: ['blue', 'green', 'orange', 'red'] },
      detail.from,
      detail.to,
    );
    expect(charts).toHaveLength(17);
    expect(new Set(charts.map((chart) => chart.id)).size).toBe(17);
    for (const chart of charts) {
      expect(chart.title).not.toBe('');
      expect(chart.meaning).not.toBe('');
      expect(chart.source).not.toBe('');
    }
    expect(charts.find((chart) => chart.id === 'collection-history')?.issue).not.toBe('');
  });
});

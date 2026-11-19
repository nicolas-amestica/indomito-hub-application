import type { ChartType } from 'chart.js';
import type { BalanceBudget, BalanceRow } from '../interfaces/balance.interface';
import type { BalanceChart, BalancePalette } from '../types/balance-chart';
import { balanceCurve, calculateBalance } from './calculate-balance';
import { operatingBalance } from './operating-balance';
import { supplierMetrics } from './financial-metrics';

/** Cada serie conserva fuente, alcance y los mismos datos para su alternativa tabular. */
export function buildBalanceCharts(
  rows: BalanceRow[],
  selected: BalanceRow | null,
  budget: BalanceBudget | null,
  palette: BalancePalette,
  from: string,
  to: string,
): BalanceChart[] {
  const charts: BalanceChart[] = [];
  const add = (
    id: string,
    title: string,
    meaning: string,
    section: string,
    type: ChartType,
    labels: string[],
    series: { name: string; values: (number | null)[] }[],
    source: string,
    simulated = false,
    issue = '',
    unit = 'CLP',
    horizontal = false,
    stacked = false,
  ): BalanceChart => {
    const chart: BalanceChart = {
      id,
      title,
      meaning,
      section,
      source,
      type,
      series: series.map((item) => item.name),
      unit,
      simulated,
      issue,
      data: {
        labels,
        datasets: series.map((item, index) => ({
          label: item.name,
          data: item.values,
          backgroundColor:
            type === 'doughnut' ? palette.colors : palette.colors[index % palette.colors.length],
          borderColor: palette.colors[index % palette.colors.length],
          borderWidth: 2,
          tension: 0.2,
          spanGaps: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: { labels: { color: palette.text } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = Array.isArray(context.raw)
                  ? chart.rows[context.dataIndex]?.values[context.datasetIndex]
                  : context.raw;
                const suffix = context.dataset.label?.includes('%') ? '%' : unit;
                return `${context.dataset.label}: ${typeof value === 'number' ? new Intl.NumberFormat('es-CL').format(value) : 'Sin datos'} ${suffix}`;
              },
            },
          },
        },
        ...(type === 'doughnut'
          ? {}
          : {
              scales: {
                x: { stacked, ticks: { color: palette.text }, grid: { color: palette.grid } },
                y: { stacked, ticks: { color: palette.text }, grid: { color: palette.grid } },
              },
            }),
      },
      rows: labels.map((label, index) => ({
        label,
        values: series.map((item) => item.values[index] ?? null),
      })),
    };
    charts.push(chart);
    return chart;
  };
  const names = rows.map((row) => `${row.trip.institutionName} · ${row.trip.id.slice(-5)}`);
  add(
    'collection',
    '¿Cuánto falta cobrar por viaje?',
    'Cada color representa una parte distinta de la cobranza. Los abonos pendientes están separados de las cuotas.',
    'collections',
    'bar',
    names,
    [
      {
        name: 'Recibido aplicado',
        values: rows.map((row) => row.finance?.position.appliedReceipts ?? null),
      },
      {
        name: 'Abono pendiente',
        values: rows.map((row) => row.finance?.position.depositReceivable ?? null),
      },
      {
        name: 'Cuotas no vencidas',
        values: rows.map((row) =>
          row.finance ? row.finance.position.installmentReceivable - row.finance.overdue : null,
        ),
      },
      { name: 'Cuotas vencidas', values: rows.map((row) => row.finance?.overdue ?? null) },
    ],
    'Posición actual de cuentas; vencimiento al último día del rango',
    false,
    '',
    'CLP',
    true,
    true,
  );
  const calculations = rows.map((row) => operatingBalance(row));
  add(
    'ranking',
    'Viajes con ganancia o pérdida prevista',
    'Resultado operativo estimado. Un valor bajo cero requiere revisar precio o costos.',
    'summary',
    'bar',
    names,
    [
      {
        name: 'Resultado previsto',
        values: calculations.map((calculation) => calculation?.result ?? null),
      },
    ],
    'Venta contractual operativa actual sin IVA menos estimación de costo neto guardada',
    true,
    '',
    'CLP',
    true,
  );
  const ranking = charts.find((chart) => chart.id === 'ranking');
  if (ranking)
    ranking.data.datasets[0].backgroundColor = calculations.map((calculation) =>
      (calculation?.result ?? 0) < 0 ? palette.colors[3] : palette.colors[1],
    );
  const bubble = add(
    'bubble',
    'Venta, margen y tamaño del grupo',
    'La altura indica el margen y el tamaño de cada burbuja, la cantidad de viajeros.',
    'summary',
    'bubble',
    names,
    [],
    'Presupuestos guardados; escenarios comerciales, no ingresos bancarios',
    true,
    '',
    'Venta neta CLP / margen %',
  );
  bubble.data = {
    datasets: rows.flatMap((row, index) => {
      const calc = calculations[index];
      return !calc || calc.margin === null || calc.netSale === null
        ? []
        : [
            {
              label: names[index],
              data: [
                {
                  x: calc.netSale,
                  y: calc.margin,
                  r: Math.min(30, Math.max(4, Math.sqrt(row.state.current!.totalPassengers) * 2)),
                },
              ],
              backgroundColor: palette.colors[index % palette.colors.length],
            },
          ];
    }),
  };
  // Tooltip específico: el radio representa personas, no dinero.
  bubble.options = {
    ...bubble.options,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const point = context.raw as { x: number; y: number };
            return `${context.dataset.label}: venta neta ${new Intl.NumberFormat('es-CL').format(point.x)} CLP; margen ${point.y.toFixed(1)} %`;
          },
        },
      },
    },
  };
  bubble.rows = rows.map((row, index) => ({
    label: names[index],
    values: [
      calculations[index]?.netSale ?? null,
      calculations[index]?.margin ?? null,
      row.state.current?.totalPassengers ?? null,
    ],
  }));
  bubble.series = ['Venta neta CLP', 'Margen %', 'Viajeros'];
  const f = selected?.finance;
  if (!selected || !budget) return charts;
  const calc = calculateBalance(budget);
  const baseline = selected.state.baseline ? calculateBalance(selected.state.baseline) : null;
  const categories = [
    ...budget.categories,
    ...(selected.state.baseline?.categories ?? []).filter(
      (category) => !budget.categories.some((current) => current.id === category.id),
    ),
  ];
  const labels = categories.map((category) => category.name);
  const amounts = categories.map((category) =>
    calc.rows
      .filter((row) => row.categoryId === category.id)
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const originals = categories.map((category) =>
    baseline
      ? baseline.rows
          .filter((row) => row.categoryId === category.id)
          .reduce((sum, row) => sum + row.amount, 0)
      : null,
  );
  add(
    'composition',
    '¿En qué se va el presupuesto?',
    'Compara la participación de cada categoría. La contingencia se muestra en el total del presupuesto.',
    'budget',
    'doughnut',
    labels,
    [{ name: 'Costos netos', values: amounts }],
    'Partidas incluidas del presupuesto seleccionado',
    true,
    calc.cost === null ? 'Faltan partidas o hay entradas inválidas.' : '',
  );
  add(
    'comparison',
    'Original, actualizado y confirmado',
    'Sin datos significa que aún falta presupuestar, aprobar o confirmar; no equivale a cero.',
    'budget',
    'bar',
    ['Costo del viaje'],
    [
      { name: 'Línea base aprobada', values: [baseline?.cost ?? null] },
      { name: 'Estimación seleccionada', values: [calc.cost] },
      {
        name: 'Final confirmado',
        values: [
          budget.lines.filter((line) => line.included).length &&
          budget.lines
            .filter((line) => line.included)
            .every((line) => line.state === 'confirmed') &&
          budget.contingency === 0
            ? calc.cost
            : null,
        ],
      },
    ],
    'Snapshots independientes; CLP netos',
    true,
  );
  const waterfall = add(
    'waterfall',
    'De la venta al resultado previsto',
    'Parte de la venta sin IVA y descuenta cada costo una sola vez. Los pagos a proveedores no se vuelven a descontar.',
    'summary',
    'bar',
    ['Venta neta', ...labels, 'Contingencia', 'Resultado'],
    [
      {
        name: 'CLP netos',
        values: [
          calc.netSale,
          ...amounts.map((value) => -value),
          calc.cost === null ? null : -(calc.cost - amounts.reduce((sum, value) => sum + value, 0)),
          calc.result,
        ],
      },
    ],
    'Precio elegido, IVA del snapshot y partidas incluidas',
    true,
  );
  let running = calc.netSale;
  waterfall.data.datasets[0].data = waterfall.rows.map((row, index) => {
    const value = row.values[0];
    if (value === null) return null;
    if (index === 0 || index === waterfall.rows.length - 1) return [0, value];
    const start = running;
    running += value;
    return [running, start];
  });
  const min = 1;
  const max = Math.min(1000 - budget.freePassengers, Math.max(60, budget.totalPassengers * 2));
  const curve = balanceCurve(budget, min, max);
  const breakEven = curve.find((point) => point.result !== null && point.result >= 0);
  add(
    'fixed',
    '¿Qué pasa si cambia el grupo?',
    `Precio fijo de ${new Intl.NumberFormat('es-CL').format(budget.pricePerPayer)} CLP por pagante; ${budget.freePassengers} liberados. ${breakEven ? `Primer equilibrio: ${breakEven.paying} pagantes.` : `Sin equilibrio entre ${min} y ${max} pagantes.`}`,
    'simulation',
    'line',
    curve.map((point) => String(point.paying)),
    [{ name: 'Resultado', values: curve.map((point) => point.result) }],
    `Enumeración discreta ${min}–${max}; capacidades y escalones de partidas`,
    true,
  );
  add(
    'price',
    '¿Cuánto habría que cobrar?',
    'Precio bruto por pagante para alcanzar tu objetivo, con los descuentos e impuestos elegidos.',
    'simulation',
    'line',
    curve.map((point) => String(point.paying)),
    [{ name: 'Precio necesario', values: curve.map((point) => point.requiredPrice) }],
    'Mismo motor y objetivo seleccionado; cantidades discretas',
    true,
  );
  const sensitivity = budget.lines
    .filter((line) => line.included)
    .map((line) => {
      const changed = calculateBalance({
        ...budget,
        lines: budget.lines.map((item) =>
          item.id === line.id
            ? {
                ...item,
                unitPrice: item.unitPrice * 1.1,
                tiers: item.tiers.map((tier) => ({ ...tier, unitPrice: tier.unitPrice * 1.1 })),
              }
            : item,
        ),
      });
      return {
        label: `${line.description} +10 %`,
        impact:
          changed.result === null || calc.result === null ? null : changed.result - calc.result,
      };
    });
  for (const currency of ['USD', 'BRL'] as const)
    if (budget.lines.some((line) => line.included && line.currency === currency)) {
      const changed = calculateBalance({
        ...budget,
        lines: budget.lines.map((line) =>
          line.currency === currency
            ? { ...line, rate: line.rate * 1.1, buffer: line.buffer * 1.1 }
            : line,
        ),
      });
      sensitivity.push({
        label: `${currency} +10 %`,
        impact:
          changed.result === null || calc.result === null ? null : changed.result - calc.result,
      });
    }
  sensitivity.sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0));
  add(
    'sensitivity',
    '¿Qué cambios afectan más el resultado?',
    'Compara aumentos equivalentes de 10 % en un solo costo o divisa por vez.',
    'simulation',
    'bar',
    sensitivity.map((item) => item.label),
    [{ name: 'Cambio en resultado', values: sensitivity.map((item) => item.impact) }],
    'Sensibilidad local; otras variables constantes',
    true,
    '',
    'CLP',
    true,
  );
  const sorted = [...calc.rows].sort((a, b) => b.amount - a.amount);
  let accumulated = 0;
  const total = sorted.reduce((sum, row) => sum + row.amount, 0);
  const pareto = add(
    'pareto',
    '¿Qué partidas concentran el costo?',
    'Las barras muestran los costos mayores; la línea muestra cuánto acumulan del total.',
    'budget',
    'bar',
    sorted.map((row) => budget.lines.find((line) => line.id === row.id)?.description ?? row.id),
    [
      { name: 'Costo', values: sorted.map((row) => row.amount) },
      {
        name: 'Acumulado %',
        values: sorted.map((row) => {
          accumulated += row.amount;
          return total ? (accumulated / total) * 100 : 0;
        }),
      },
    ],
    'Partidas incluidas, sin contingencia',
    true,
  );
  pareto.data.datasets[1] = {
    label: 'Acumulado %',
    data: pareto.rows.map((row) => row.values[1]),
    type: 'line',
    yAxisID: 'percentage',
    borderColor: palette.colors[1],
    backgroundColor: palette.colors[1],
  };
  pareto.options.scales = {
    ...pareto.options.scales,
    percentage: {
      position: 'right',
      min: 0,
      max: 100,
      ticks: { color: palette.text },
      grid: { drawOnChartArea: false },
    },
  };
  add(
    'variance',
    '¿Dónde nos alejamos del presupuesto original?',
    'Un valor positivo significa más costo que en la línea base.',
    'budget',
    'bar',
    labels,
    [
      {
        name: 'Diferencia',
        values: amounts.map((value, index) =>
          originals[index] === null ? null : value - originals[index]!,
        ),
      },
    ],
    'Categorías con identificadores estables, presupuesto vs línea base',
    true,
    baseline ? '' : 'Aún no existe una línea base aprobada.',
  );
  add(
    'currency',
    'Costos expuestos a otras monedas',
    'Todo se expresa en CLP usando la tasa y el resguardo guardados en cada partida.',
    'budget',
    'doughnut',
    ['CLP', 'USD', 'BRL'],
    [
      {
        name: 'Equivalente CLP',
        values: ['CLP', 'USD', 'BRL'].map((currency) =>
          calc.rows
            .filter((row) => row.currency === currency)
            .reduce((sum, row) => sum + row.amount, 0),
        ),
      },
    ],
    'Moneda original y conversión del presupuesto',
    true,
  );
  if (!f) {
    add(
      'cash-unavailable',
      'Cobranza y caja del viaje',
      'No se pueden calcular resultados operativos a partir de consultas ausentes.',
      'cash',
      'bar',
      [],
      [],
      'Tesorería',
      false,
      selected.issue || 'Todavía no hay datos de tesorería.',
    );
    return charts;
  }
  const collectionDates = new Map<string, { actual: number; expected: number }>();
  for (const due of f.scheduled) {
    const value = collectionDates.get(due.date) ?? { actual: 0, expected: 0 };
    value.expected += due.original;
    collectionDates.set(due.date, value);
  }
  for (const receipt of f.receiptHistory ?? []) {
    const value = collectionDates.get(receipt.date) ?? { actual: 0, expected: 0 };
    value.actual += receipt.amount;
    collectionDates.set(receipt.date, value);
  }
  let actual = 0;
  let expected = 0;
  const accumulatedCollections = [...collectionDates]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => {
      actual += value.actual;
      expected += value.expected;
      return { date, actual, expected };
    })
    .filter((row) => row.date >= from && row.date <= to);
  add(
    'collection-history',
    'Cobros de cuotas frente al plan vigente',
    'Compara cobros brutos aplicados con vencimientos del plan actual; excluye abonos y no representa el calendario original anterior a descuentos o anexos.',
    'collections',
    'line',
    accumulatedCollections.map((row) => row.date),
    [
      {
        name: 'Cuotas cobradas acumuladas',
        values: accumulatedCollections.map((row) => row.actual),
      },
      { name: 'Plan vigente acumulado', values: accumulatedCollections.map((row) => row.expected) },
    ],
    'Historial de cuentas reconciliado contra cuotas pagadas; calendario vigente',
    false,
    f.historyComplete
      ? ''
      : 'El historial disponible no explica todos los cobros aplicados. No dibujamos una curva incompleta como si fuera un histórico completo.',
  );
  add(
    'aging',
    'Cuotas vencidas: ¿desde hace cuánto?',
    'Agrupa solo cuotas pendientes; los abonos pendientes se muestran aparte.',
    'collections',
    'bar',
    ['1–30 días', '31–60 días', '61–90 días', 'Más de 90 días'],
    [{ name: 'Cuotas vencidas', values: f.aging }],
    `Posición actual, antigüedad al ${to}`,
  );
  add(
    'suppliers',
    'Pagos y pendientes con proveedores',
    'Lo pagado forma parte del compromiso. Las recuperaciones efectivas descuentan pagos; los acuerdos pendientes no son dinero recibido.',
    'cash',
    'bar',
    f.suppliers.map((supplier) => supplier.name),
    [
      {
        name: 'Pagado neto recuperado',
        values: f.suppliers.map((supplier) => supplier.paid - supplier.refundReceived),
      },
      {
        name: 'Pendiente del compromiso',
        values: f.suppliers.map((supplier) =>
          Math.max(0, supplier.committed - supplier.paid + supplier.refundReceived),
        ),
      },
      {
        name: 'Recuperación esperada (informativa)',
        values: f.suppliers.map((supplier) => supplier.refundAgreed - supplier.refundReceived),
      },
    ],
    'Posición actual de compromisos, pagos y recuperaciones',
    false,
    '',
    'CLP',
    true,
    false,
  );
  const months = new Map<string, { inflows: number; outflows: number }>();
  for (const day of f.cashDays) {
    const month = day.date.slice(0, 7);
    const entry = months.get(month) ?? { inflows: 0, outflows: 0 };
    entry.inflows += day.inflows;
    entry.outflows += day.outflows;
    months.set(month, entry);
  }
  const monthly = [...months].sort(([a], [b]) => a.localeCompare(b));
  const combined = add(
    'monthly',
    'Entradas y salidas del mes',
    'Movimiento bancario del período. El movimiento neto no es la ganancia del viaje.',
    'cash',
    'bar',
    monthly.map(([month]) => month),
    [
      { name: 'Entradas', values: monthly.map(([, value]) => value.inflows) },
      { name: 'Salidas', values: monthly.map(([, value]) => value.outflows) },
      {
        name: 'Movimiento neto',
        values: monthly.map(([, value]) => value.inflows - value.outflows),
      },
    ],
    `Eventos BANK ${from} a ${to}`,
  );
  combined.data.datasets[2] = {
    label: 'Movimiento neto',
    data: combined.rows.map((row) => row.values[2]),
    type: 'line',
    borderColor: palette.colors[2],
    backgroundColor: palette.colors[2],
  };
  let cash = f.opening;
  const daily = new Map<string, number>();
  for (const day of f.cashDays) daily.set(day.date, day.inflows - day.outflows);
  const cashRows = [
    { date: `${from} · apertura`, amount: cash },
    ...[...daily]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => {
        cash += amount;
        return { date, amount: cash };
      }),
  ];
  add(
    'cash',
    '¿Cómo evoluciona la caja registrada?',
    `Saldo inicial registrado: ${new Intl.NumberFormat('es-CL').format(f.opening)} CLP. No incluye movimientos anteriores al inicio del registro en Hub.`,
    'cash',
    'line',
    cashRows.map((row) => row.date),
    [{ name: 'Caja registrada', values: cashRows.map((row) => row.amount) }],
    `Tesorería: eventos bancarios registrados hasta ${to}`,
  );
  return charts;
}

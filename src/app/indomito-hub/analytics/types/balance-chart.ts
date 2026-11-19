import type { ChartData, ChartOptions, ChartType } from 'chart.js';
/** Gráfico y alternativa textual alimentados por la misma serie. */
export interface BalanceChart {
  id: string;
  title: string;
  meaning: string;
  source: string;
  section: string;
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
  rows: { label: string; values: (number | null)[] }[];
  series: string[];
  unit: string;
  issue: string;
  simulated: boolean;
}
export interface BalancePalette {
  text: string;
  grid: string;
  colors: string[];
}

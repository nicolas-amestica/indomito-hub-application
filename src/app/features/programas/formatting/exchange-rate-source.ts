import type { ExchangeRateSource, ExchangeSnapshot } from '../interfaces/program.interface';

const SOURCE_LABELS: Record<ExchangeSnapshot['source'], string> = {
  'banco-central': 'Banco Central de Chile',
  'currency-api': 'Currency API',
  unknown: 'Fuente histórica no registrada',
};

/** Etiqueta visible y auditable de la procedencia del snapshot. */
export function exchangeRateSourceLabel(snapshot: ExchangeSnapshot): string {
  return exchangeRateOriginLabel(snapshot.source, snapshot.isFallback);
}

/** Etiqueta cuando el componente recibe la fuente y el estado por separado. */
export function exchangeRateOriginLabel(
  sourceCode: ExchangeRateSource,
  isFallback: boolean,
): string {
  const source = SOURCE_LABELS[sourceCode] ?? SOURCE_LABELS.unknown;
  return isFallback ? `Respaldo DynamoDB · origen ${source}` : source;
}

import type { NumericOption } from '../interfaces/numeric-option.interface';

export function buildNumericOptions(
  min: number,
  max: number,
  step: number,
  suffix: string,
): NumericOption[] {
  const length = Math.floor((max - min) / step) + 1;
  return Array.from({ length }, (_, index) => {
    const value = min + index * step;
    return { value, label: `${value} ${suffix}` };
  });
}

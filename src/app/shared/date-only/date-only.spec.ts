import { describe, expect, it } from 'vitest';
import { dateOnlyToLocalDate, isDateOnly, localDateToDateOnly } from './date-only';

describe('date-only', () => {
  it('conserva el día civil sin pasar por UTC', () => {
    const value = dateOnlyToLocalDate('2028-02-29');
    expect(localDateToDateOnly(value)).toBe('2028-02-29');
  });

  it('rechaza días inexistentes', () => {
    expect(isDateOnly('2027-02-29')).toBe(false);
  });
});

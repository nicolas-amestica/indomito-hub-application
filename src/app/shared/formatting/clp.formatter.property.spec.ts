/** Propiedad 30 del formato entero de montos en CLP. */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatCLP, parseCLP } from './clp.formatter';

describe('formatCLP · propiedad', () => {
  it('Feature: program-form, Property 30: El formato de montos en CLP es reversible', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
        (amount) => {
          expect(parseCLP(formatCLP(amount))).toBe(amount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

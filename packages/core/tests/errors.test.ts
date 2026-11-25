import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PricingEngine, PricingError } from '../src/index.js';

/** Runs `fn` and returns what it threw, so one error can be checked from several sides. */
function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the function to throw');
}

describe('PricingError', () => {
  const input = { rule: 'coating', dimensions: { width: 2, height: 3 }, quantity: 1 };

  describe('UNKNOWN_RULE', () => {
    const engine = new PricingEngine({
      rules: [{ name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' }],
    });

    it('is thrown for a rule that does not exist', () => {
      const error = catchError(() => engine.calculate({ ...input, rule: 'roof' }));

      expect(error).toBeInstanceOf(PricingError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('code', 'UNKNOWN_RULE');
      expect(error).toHaveProperty('name', 'PricingError');
      expect(error).toHaveProperty('message', 'Unknown rule: "roof"');
    });
  });

  describe('NO_EFFECTIVE_PRICE_LIST', () => {
    const engine = new PricingEngine({
      priceLists: [
        {
          version: '2025',
          effectiveFrom: '2025-01-01',
          rules: [{ name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' }],
        },
      ],
    });

    it('is thrown for a date before the first price list', () => {
      const error = catchError(() => engine.calculate({ ...input, date: '2024-06-15' }));

      expect(error).toBeInstanceOf(PricingError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty('code', 'NO_EFFECTIVE_PRICE_LIST');
      expect(error).toHaveProperty('name', 'PricingError');
      expect(error).toHaveProperty('message', 'No price list is effective on 2024-06-15');
    });
  });

  it('leaves input validation errors as ZodError', () => {
    const engine = new PricingEngine({
      rules: [{ name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' }],
    });

    const error = catchError(() => engine.calculate({ ...input, quantity: -1 }));

    expect(error).toBeInstanceOf(ZodError);
    expect(error).not.toBeInstanceOf(PricingError);
  });
});

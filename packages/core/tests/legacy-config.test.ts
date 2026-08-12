import { describe, expect, it } from 'vitest';
import { PricingEngine, type PricingEngineConfig } from '../src/index.js';

// Back-compat contract: a plain { rules } config must behave exactly as it did before
// price list versioning (v0.4) was introduced.
describe('legacy { rules } config', () => {
  const engine = new PricingEngine({
    rules: [
      {
        name: 'flat-surface',
        type: 'area',
        unitPrice: 12.5,
        unit: 'm2',
        minCharge: 50,
        adjustments: [{ name: 'sale', type: 'percentage', value: -10 }],
      },
    ],
  });

  const input = { rule: 'flat-surface', dimensions: { width: 2, height: 3 }, quantity: 2 };

  it('runs the full pipeline: strategy, minCharge, adjustments, quantity', () => {
    expect(engine.calculate(input)).toEqual({
      rule: 'flat-surface',
      measure: 6,
      unitPrice: 12.5,
      subtotal: 75,
      adjustments: [{ name: 'sale', type: 'percentage', value: -10, amount: -7.5 }],
      adjusted: 67.5,
      quantity: 2,
      total: 135,
    });
  });

  // toEqual ignores keys whose value is undefined, so the key set is pinned separately.
  it('returns the pre-v0.4 result shape with no extra fields', () => {
    expect(Object.keys(engine.calculate(input)).sort()).toEqual([
      'adjusted',
      'adjustments',
      'measure',
      'quantity',
      'rule',
      'subtotal',
      'total',
      'unitPrice',
    ]);
  });

  it('keeps the unknown rule message unchanged', () => {
    expect(() => engine.calculate({ ...input, rule: 'nonexistent' })).toThrow(
      'Unknown rule: "nonexistent"',
    );
  });

  describe('date input', () => {
    const expected = engine.calculate(input);

    it('is ignored for a past ISO string date', () => {
      expect(engine.calculate({ ...input, date: '1999-01-01' })).toEqual(expected);
    });

    it('is ignored for a future Date object', () => {
      expect(engine.calculate({ ...input, date: new Date('2999-12-31') })).toEqual(expected);
    });

    it('never reports a missing price list', () => {
      expect(() => engine.calculate({ ...input, date: '1970-01-01' })).not.toThrow();
    });
  });

  // The union type forbids this shape; the cast verifies the runtime guard still rejects it.
  it('rejects a config that mixes rules and priceLists', () => {
    // ZodError.message is serialized JSON, so quotes inside the issue text arrive escaped.
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: 'flat-surface', type: 'area', unitPrice: 12.5, unit: 'm2' }],
          priceLists: [
            {
              version: '2026',
              effectiveFrom: '2026-01-01',
              rules: [{ name: 'flat-surface', type: 'area', unitPrice: 14, unit: 'm2' }],
            },
          ],
        } as unknown as PricingEngineConfig),
    ).toThrow(/Provide either .*rules.* or .*priceLists.*, not both/);
  });
});

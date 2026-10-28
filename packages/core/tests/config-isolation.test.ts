import { describe, expect, it } from 'vitest';
import { PricingEngine } from '../src/index.js';

// Each test keeps a reference to a nested part of the config and mutates it after construction:
// the engine must not see the change (and must not use data that was never validated).
describe('config isolation', () => {
  const input = { rule: 'coating', dimensions: { width: 2, height: 1 }, quantity: 1 };

  it('ignores a unitPrice changed after construction', () => {
    const rule = { name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' };
    const engine = new PricingEngine({ rules: [rule] });

    rule.unitPrice = -5;

    const result = engine.calculate(input);
    expect(result.total).toBe(20);
  });

  it('ignores tier bands changed after construction', () => {
    const firstBand = { upTo: 5, unitPrice: 15 };
    const engine = new PricingEngine({
      rules: [
        {
          name: 'coating',
          type: 'area',
          unit: 'm2',
          tiers: { mode: 'volume', bands: [firstBand, { unitPrice: 10 }] },
        },
      ],
    });

    firstBand.unitPrice = -1;

    const result = engine.calculate(input);
    expect(result.unitPrice).toBe(15);
    expect(result.total).toBe(30);
  });

  it('ignores a rule pushed into the rules array after construction', () => {
    const config = { rules: [{ name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' }] };
    const engine = new PricingEngine(config);

    config.rules.push({ name: 'primer', type: 'area', unitPrice: 5, unit: 'm2' });

    expect(() => engine.calculate({ ...input, rule: 'primer' })).toThrow('Unknown rule: "primer"');
  });

  it('ignores a unitPrice changed inside a price list after construction', () => {
    const rule = { name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' };
    const engine = new PricingEngine({
      priceLists: [{ version: '2025', effectiveFrom: '2025-01-01', rules: [rule] }],
    });

    rule.unitPrice = -5;

    const result = engine.calculate({ ...input, date: '2025-06-15' });
    expect(result.total).toBe(20);
  });
});

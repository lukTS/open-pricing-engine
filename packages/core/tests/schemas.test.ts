import { describe, expect, it } from 'vitest';
import {
  CalculationDimensionsSchema,
  PricingEngine,
  type PricingEngineConfig,
} from '../src/index.js';

describe('PricingRuleConfigSchema', () => {
  it('throws on empty rule name', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: '', type: 'area', unitPrice: 12.5, unit: 'm2', minCharge: 50 }],
        }),
    ).toThrow();
  });

  it('throws on zero unitPrice', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: 'test', type: 'area', unitPrice: 0, unit: 'm2', minCharge: 50 }],
        }),
    ).toThrow();
  });

  it('throws on negative unitPrice', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: 'test', type: 'area', unitPrice: -30, unit: 'm2', minCharge: 50 }],
        }),
    ).toThrow();
  });

  it('throws on empty unit', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: 'test', type: 'area', unitPrice: 30, unit: '', minCharge: 50 }],
        }),
    ).toThrow();
  });

  it('throws on zero minCharge', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: 'test', type: 'area', unitPrice: 30, unit: 'm2', minCharge: 0 }],
        }),
    ).toThrow();
  });

  it('throws on negative minCharge', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: 'test', type: 'area', unitPrice: 30, unit: 'm2', minCharge: -50 }],
        }),
    ).toThrow();
  });

  it('throws if no rules are provided', () => {
    expect(() => new PricingEngine({ rules: [] })).toThrow();
  });

  it('throws if rule names are not unique', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [
            { name: 'duplicate', type: 'area', unitPrice: 30, unit: 'm2', minCharge: 50 },
            { name: 'duplicate', type: 'area', unitPrice: 25, unit: 'm2' },
          ],
        }),
    ).toThrow();
  });
});

describe('CalculationInputSchema', () => {
  const engine = new PricingEngine({
    rules: [
      { name: 'flat-surface', type: 'area', unitPrice: 12.5, unit: 'm2' },
      { name: 'premium', type: 'area', unitPrice: 30, unit: 'm2', minCharge: 50 },
    ],
  });

  it('throws on empty rule name in input', () => {
    expect(() =>
      engine.calculate({
        rule: '',
        dimensions: { width: 2, height: 3 },
        quantity: 1,
      }),
    ).toThrow();
  });

  it('throws on zero quantity', () => {
    expect(() =>
      engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 3 },
        quantity: 0,
      }),
    ).toThrow();
  });

  it('throws on negative quantity', () => {
    expect(() =>
      engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 3 },
        quantity: -1,
      }),
    ).toThrow();
  });

  it('throws on negative width', () => {
    expect(() =>
      engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: -1, height: 3 },
        quantity: 1,
      }),
    ).toThrow();
  });

  it('throws on negative height', () => {
    expect(() =>
      engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: -3 },
        quantity: 1,
      }),
    ).toThrow();
  });
  it('throws on zero width', () => {
    expect(() =>
      engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 0, height: 3 },
        quantity: 1,
      }),
    ).toThrow();
  });

  it('throws on zero height', () => {
    expect(() =>
      engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 0 },
        quantity: 1,
      }),
    ).toThrow();
  });
});

describe('AdjustmentSchema', () => {
  it('throws on invalid adjustment type', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [
            {
              name: 'test',
              type: 'area',
              unitPrice: 10,
              unit: 'm2',
              // @ts-expect-error testing runtime validation of an invalid adjustment type
              adjustments: [{ name: 'adj', type: 'invalid', value: 5 }],
            },
          ],
        }),
    ).toThrow();
  });

  it('throws on percentage above 100', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [
            {
              name: 'test',
              type: 'area',
              unitPrice: 10,
              unit: 'm2',
              adjustments: [{ name: 'adj', type: 'percentage', value: 150 }],
            },
          ],
        }),
    ).toThrow();
  });

  it('throws on percentage below -100', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [
            {
              name: 'test',
              type: 'area',
              unitPrice: 10,
              unit: 'm2',
              adjustments: [{ name: 'adj', type: 'percentage', value: -150 }],
            },
          ],
        }),
    ).toThrow();
  });

  it('throws on duplicate adjustment names', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [
            {
              name: 'test',
              type: 'area',
              unitPrice: 10,
              unit: 'm2',
              adjustments: [
                { name: 'same', type: 'percentage', value: 5 },
                { name: 'same', type: 'fixed', value: 10 },
              ],
            },
          ],
        }),
    ).toThrow();
  });
});

describe('CalculationDimensionsSchema', () => {
  it('accepts dimensions with only length', () => {
    expect(() => CalculationDimensionsSchema.parse({ length: 5 })).not.toThrow();
  });

  it('still rejects a non-positive value', () => {
    expect(() => CalculationDimensionsSchema.parse({ length: -5 })).toThrow();
  });

  it('still accepts area dimensions', () => {
    expect(() => CalculationDimensionsSchema.parse({ width: 2, height: 3 })).not.toThrow();
  });
});

describe('PriceListSchema', () => {
  const rules = [{ name: 'flat-surface', type: 'area', unitPrice: 10, unit: 'm2' }];

  it('throws if a price list has no rules', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [{ version: '2026', effectiveFrom: '2026-01-01', rules: [] }],
        }),
    ).toThrow('At least one rule is required');
  });

  it('throws if rule names are not unique within a price list', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            {
              version: '2026',
              effectiveFrom: '2026-01-01',
              rules: [
                { name: 'duplicate', type: 'area', unitPrice: 10, unit: 'm2' },
                { name: 'duplicate', type: 'area', unitPrice: 20, unit: 'm2' },
              ],
            },
          ],
        }),
    ).toThrow('Rule names must be unique within a price list');
  });

  it('allows the same rule name across price lists', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2025', effectiveFrom: '2025-01-01', effectiveTo: '2026-01-01', rules },
            { version: '2026', effectiveFrom: '2026-01-01', rules },
          ],
        }),
    ).not.toThrow();
  });

  it('throws when effectiveTo equals effectiveFrom', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2026', effectiveFrom: '2026-01-01', effectiveTo: '2026-01-01', rules },
          ],
        }),
    ).toThrow('effectiveFrom must be before effectiveTo');
  });

  it('throws when effectiveTo is before effectiveFrom', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2026', effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01', rules },
          ],
        }),
    ).toThrow('effectiveFrom must be before effectiveTo');
  });
});

describe('PricingEngineConfigSchema', () => {
  const rules = [{ name: 'flat-surface', type: 'area', unitPrice: 10, unit: 'm2' }];

  // The union type forbids this shape; the cast verifies the runtime guard still rejects it.
  it('throws when both rules and priceLists are provided', () => {
    expect(
      () =>
        new PricingEngine({
          rules,
          priceLists: [{ version: '2026', effectiveFrom: '2026-01-01', rules }],
        } as unknown as PricingEngineConfig),
    ).toThrow('not both');
  });

  it('throws when neither rules nor priceLists are provided', () => {
    expect(() => new PricingEngine({} as unknown as PricingEngineConfig)).toThrow(
      'Config must contain',
    );
  });

  it('throws if priceLists is empty', () => {
    expect(() => new PricingEngine({ priceLists: [] })).toThrow(
      'At least one price list is required',
    );
  });

  it('throws on overlapping effective windows', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2026-Q1', effectiveFrom: '2026-01-01', effectiveTo: '2026-04-01', rules },
            { version: '2026-Q2', effectiveFrom: '2026-03-01', effectiveTo: '2026-07-01', rules },
          ],
        }),
    ).toThrow('overlapping effective windows');
  });

  it('detects overlap regardless of input order', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2026-Q2', effectiveFrom: '2026-03-01', effectiveTo: '2026-07-01', rules },
            { version: '2026-Q1', effectiveFrom: '2026-01-01', effectiveTo: '2026-04-01', rules },
          ],
        }),
    ).toThrow('overlapping effective windows');
  });

  it('throws when two price lists are open-ended', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2025', effectiveFrom: '2025-01-01', rules },
            { version: '2026', effectiveFrom: '2026-01-01', rules },
          ],
        }),
    ).toThrow('overlapping effective windows');
  });

  it('allows adjacent windows', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2026-Q1', effectiveFrom: '2026-01-01', effectiveTo: '2026-04-01', rules },
            { version: '2026-Q2', effectiveFrom: '2026-04-01', rules },
          ],
        }),
    ).not.toThrow();
  });

  it('allows gaps between windows', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2026-Q1', effectiveFrom: '2026-01-01', effectiveTo: '2026-04-01', rules },
            { version: '2026-Q3', effectiveFrom: '2026-07-01', rules },
          ],
        }),
    ).not.toThrow();
  });

  it('throws on duplicate version labels', () => {
    expect(
      () =>
        new PricingEngine({
          priceLists: [
            { version: '2026', effectiveFrom: '2026-01-01', effectiveTo: '2026-04-01', rules },
            { version: '2026', effectiveFrom: '2026-04-01', rules },
          ],
        }),
    ).toThrow('Duplicate price list version');
  });
});

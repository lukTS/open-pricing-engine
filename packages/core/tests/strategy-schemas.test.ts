import { describe, expect, it } from 'vitest';
import { PricingEngine, dimensionSchemasByType } from '../src/index.js';

const engine = new PricingEngine({
  rules: [
    { name: 'area-rule', type: 'area', unitPrice: 10, unit: 'm2' },
    { name: 'linear-rule', type: 'linear', unitPrice: 10, unit: 'm' },
    { name: 'volume-rule', type: 'volume', unitPrice: 10, unit: 'm3' },
    { name: 'weight-rule', type: 'weight', unitPrice: 10, unit: 'kg' },
    { name: 'time-rule', type: 'time', unitPrice: 10, unit: 'h' },
    { name: 'piece-rule', type: 'piece', unitPrice: 10, unit: 'pc' },
    { name: 'flat-rule', type: 'flat', unitPrice: 10, unit: 'job' },
  ],
});

describe('per-strategy dimension validation', () => {
  it('area stays backward compatible', () => {
    const result = engine.calculate({
      rule: 'area-rule',
      dimensions: { width: 2, height: 3 },
      quantity: 1,
    });
    expect(result.measure).toBe(6);
  });

  it('volume requires depth', () => {
    expect(() =>
      engine.calculate({ rule: 'volume-rule', dimensions: { width: 2, height: 3 }, quantity: 1 }),
    ).toThrow(/depth/i);
  });

  it('linear requires length', () => {
    expect(() => engine.calculate({ rule: 'linear-rule', dimensions: {}, quantity: 1 })).toThrow(
      /length/i,
    );
  });

  it('weight requires weight', () => {
    expect(() => engine.calculate({ rule: 'weight-rule', dimensions: {}, quantity: 1 })).toThrow(
      /weight/i,
    );
  });

  it('time requires hours', () => {
    expect(() => engine.calculate({ rule: 'time-rule', dimensions: {}, quantity: 1 })).toThrow(
      /hours/i,
    );
  });

  it('piece and flat need no dimensions', () => {
    expect(engine.calculate({ rule: 'piece-rule', dimensions: {}, quantity: 1 }).measure).toBe(1);
    expect(engine.calculate({ rule: 'flat-rule', dimensions: {}, quantity: 1 }).measure).toBe(1);
  });
});

describe('dimensionSchemasByType (schema level)', () => {
  it('volume schema rejects missing depth', () => {
    expect(() => dimensionSchemasByType.volume.parse({ width: 1, height: 2 })).toThrow(/depth/i);
  });

  it('volume schema accepts full dimensions', () => {
    expect(() =>
      dimensionSchemasByType.volume.parse({ width: 1, height: 2, depth: 3 }),
    ).not.toThrow();
  });

  it('rejects a non-positive required value', () => {
    expect(() => dimensionSchemasByType.linear.parse({ length: -5 })).toThrow(/positive/i);
  });
});

describe('rule type validation', () => {
  it('rejects an unknown strategy type at config time', () => {
    expect(
      () =>
        new PricingEngine({
          rules: [{ name: 'x', type: 'nope', unitPrice: 10, unit: 'u' }],
        }),
    ).toThrow();
  });
});

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

  it('linear calculates length', () => {
    const result = engine.calculate({
      rule: 'linear-rule',
      dimensions: { length: 2 },
      quantity: 1,
    });
    expect(result.measure).toBe(2);
  });

  it('volume calculates volume', () => {
    const result = engine.calculate({
      rule: 'volume-rule',
      dimensions: { width: 3, height: 2, depth: 4 },
      quantity: 1,
    });
    expect(result.measure).toBe(24);
  });

  it('weight calculates weight', () => {
    const result = engine.calculate({
      rule: 'weight-rule',
      dimensions: { weight: 3 },
      quantity: 1,
    });
    expect(result.measure).toBe(3);
  });

  it('time calculates hours', () => {
    const result = engine.calculate({
      rule: 'time-rule',
      dimensions: { hours: 3 },
      quantity: 1,
    });
    expect(result.measure).toBe(3);
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

  it('area requires height', () => {
    expect(() =>
      engine.calculate({ rule: 'area-rule', dimensions: { width: 2 }, quantity: 1 }),
    ).toThrow(/height/i);
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

  it('volume schema rejects a non-positive value', () => {
    expect(() => dimensionSchemasByType.volume.parse({ width: -1, height: 2, depth: 3 })).toThrow(
      /positive/i,
    );
  });

  it('area schema rejects missing height', () => {
    expect(() => dimensionSchemasByType.area.parse({ width: 1 })).toThrow(/height/i);
  });

  it('area schema accepts full dimensions', () => {
    expect(() => dimensionSchemasByType.area.parse({ width: 3, height: 2 })).not.toThrow();
  });

  it('area schema rejects a non-positive value', () => {
    expect(() => dimensionSchemasByType.area.parse({ width: -3, height: 2 })).toThrow(/positive/i);
  });

  it('linear schema rejects missing length', () => {
    expect(() => dimensionSchemasByType.linear.parse({})).toThrow(/length/i);
  });

  it('linear schema accepts full dimensions', () => {
    expect(() => dimensionSchemasByType.linear.parse({ length: 2 })).not.toThrow();
  });

  it('linear schema rejects a non-positive value', () => {
    expect(() => dimensionSchemasByType.linear.parse({ length: -2 })).toThrow(/positive/i);
  });

  it('weight schema rejects missing weight', () => {
    expect(() => dimensionSchemasByType.weight.parse({})).toThrow(/weight/i);
  });

  it('weight schema accepts full dimensions', () => {
    expect(() => dimensionSchemasByType.weight.parse({ weight: 3 })).not.toThrow();
  });

  it('weight schema rejects a non-positive value', () => {
    expect(() => dimensionSchemasByType.weight.parse({ weight: -3 })).toThrow(/positive/i);
  });

  it('time schema rejects missing hours', () => {
    expect(() => dimensionSchemasByType.time.parse({})).toThrow(/hours/i);
  });

  it('time schema accepts full dimensions', () => {
    expect(() => dimensionSchemasByType.time.parse({ hours: 2 })).not.toThrow();
  });

  it('time schema rejects a non-positive value', () => {
    expect(() => dimensionSchemasByType.time.parse({ hours: -2 })).toThrow(/positive/i);
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

describe('full pricing pipeline per strategy (minCharge + adjustments + quantity)', () => {
  // unitPrice 10, minCharge 20, -10% adjustment, quantity 2.
  // minCharge clamps piece/flat (subtotal 10 -> 20); others stay above it.
  const scenarios = [
    { type: 'area', dimensions: { width: 2, height: 3 }, total: 108 },
    { type: 'linear', dimensions: { length: 4 }, total: 72 },
    { type: 'volume', dimensions: { width: 2, height: 2, depth: 2 }, total: 144 },
    { type: 'weight', dimensions: { weight: 5 }, total: 90 },
    { type: 'time', dimensions: { hours: 3 }, total: 54 },
    { type: 'piece', dimensions: {}, total: 36 },
    { type: 'flat', dimensions: {}, total: 36 },
  ] as const;

  it.each(scenarios)(
    '$type applies minCharge, adjustments and quantity',
    ({ type, dimensions, total }) => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'rule',
            type,
            unitPrice: 10,
            unit: 'u',
            minCharge: 20,
            adjustments: [{ name: 'discount', type: 'percentage', value: -10 }],
          },
        ],
      });

      const result = engine.calculate({ rule: 'rule', dimensions, quantity: 2 });

      expect(result.total).toBe(total);
    },
  );
});

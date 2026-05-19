import { describe, it, expect } from 'vitest';
import { PricingEngine } from '../src/engine.js';

describe('PricingEngine', () => {
  const engine = new PricingEngine({
    rules: [
      { name: 'flat-surface', type: 'area', unitPrice: 12.5, unit: 'm2' },
      { name: 'premium', type: 'area', unitPrice: 30, unit: 'm2', minCharge: 50 },
    ],
  });

  describe('calculate()', () => {
    it('computes area as width × height', () => {
      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 3 },
        quantity: 1,
      });

      expect(result.area).toBe(6);
    });

    it('computes subtotal as area × unitPrice', () => {
      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 3 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(75);
    });

    it('computes total as subtotal × quantity', () => {
      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 3 },
        quantity: 4,
      });

      expect(result.subtotal).toBe(75);
      expect(result.total).toBe(300);
    });

    it('returns all expected fields', () => {
      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 3 },
        quantity: 2,
      });

      expect(result).toEqual({
        rule: 'flat-surface',
        area: 6,
        unitPrice: 12.5,
        subtotal: 75,
        quantity: 2,
        total: 150,
      });
    });

    it('throws on unknown rule name', () => {
      expect(() =>
        engine.calculate({
          rule: 'nonexistent',
          dimensions: { width: 1, height: 1 },
          quantity: 1,
        }),
      ).toThrow('Unknown rule: "nonexistent"');
    });
  });
});

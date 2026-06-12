import { describe, it, expect } from 'vitest';
import { PricingEngine } from '../src/index.js';

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
        adjustments: [],
        adjusted: 75,
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

  describe('minCharge', () => {
    it('uses minCharge when subtotal is below it', () => {
      const result = engine.calculate({
        rule: 'premium',
        dimensions: { height: 1, width: 1 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(50);
      expect(result.total).toBe(50);
    });

    it('does not apply minCharge when subtotal exceeds it', () => {
      const result = engine.calculate({
        rule: 'premium',
        dimensions: { width: 2, height: 3 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(180);
      expect(result.total).toBe(180);
    });

    it('has no effect when minCharge is not set', () => {
      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 1, height: 1 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(12.5);
    });
  });

  describe('adjustments', () => {
    it('applies percentage discount', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
            adjustments: [{ name: 'sale', type: 'percentage', value: -20 }],
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([
        { name: 'sale', type: 'percentage', value: -20, amount: -24 },
      ]);
      expect(result.adjusted).toBe(96);
      expect(result.total).toBe(96);
    });

    it('applies percentage surcharge', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
            adjustments: [{ name: 'priority', type: 'percentage', value: 15 }],
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([
        { name: 'priority', type: 'percentage', value: 15, amount: 18 },
      ]);
      expect(result.adjusted).toBe(138);
      expect(result.total).toBe(138);
    });

    it('applies fixed discount', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
            adjustments: [{ name: 'coupon', type: 'fixed', value: -5 }],
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([
        { name: 'coupon', type: 'fixed', value: -5, amount: -5 },
      ]);
      expect(result.adjusted).toBe(115);
      expect(result.total).toBe(115);
    });

    it('applies fixed surcharge', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
            adjustments: [{ name: 'coupon', type: 'fixed', value: 10 }],
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([
        { name: 'coupon', type: 'fixed', value: 10, amount: 10 },
      ]);
      expect(result.adjusted).toBe(130);
      expect(result.total).toBe(130);
    });

    it('applies multiple adjustments in cascade order', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
            adjustments: [
              { name: 'coupon', type: 'fixed', value: 5 },
              { name: 'discount', type: 'percentage', value: -10 },
            ],
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([
        { name: 'coupon', type: 'fixed', value: 5, amount: 5 },
        { name: 'discount', type: 'percentage', value: -10, amount: -12.5 },
      ]);
      expect(result.adjusted).toBe(112.5);
      expect(result.total).toBe(112.5);
    });

    it('returns empty adjustments when empty array provided', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
            adjustments: [],
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([]);
      expect(result.adjusted).toBe(120);
      expect(result.total).toBe(120);
    });

    it('returns empty adjustments when field is omitted', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 1,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([]);
      expect(result.adjusted).toBe(120);
      expect(result.total).toBe(120);
    });

    it('multiplies adjusted by quantity for total', () => {
      const engine = new PricingEngine({
        rules: [
          {
            name: 'flat-surface',
            type: 'area',
            unitPrice: 30,
            unit: 'm2',
            adjustments: [
              { name: 'coupon', type: 'fixed', value: 5 },
              { name: 'discount', type: 'percentage', value: -10 },
            ],
          },
        ],
      });

      const result = engine.calculate({
        rule: 'flat-surface',
        dimensions: { width: 2, height: 2 },
        quantity: 3,
      });

      expect(result.subtotal).toBe(120);
      expect(result.adjustments).toEqual([
        { name: 'coupon', type: 'fixed', value: 5, amount: 5 },
        { name: 'discount', type: 'percentage', value: -10, amount: -12.5 },
      ]);
      expect(result.adjusted).toBe(112.5);
      expect(result.total).toBe(337.5);
    });
  });
});

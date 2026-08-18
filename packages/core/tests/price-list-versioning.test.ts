import { describe, expect, it } from 'vitest';
import { PricingEngine } from '../src/index.js';

// Every resolution test passes an explicit date: relying on new Date() would make the
// suite resolve a different price list as real time moves on.
describe('price list versioning', () => {
  // Deliberately unsorted — the constructor must order the lists by effectiveFrom itself.
  const engine = new PricingEngine({
    priceLists: [
      {
        version: '2026',
        effectiveFrom: '2026-01-01',
        rules: [{ name: 'coating', type: 'area', unitPrice: 12, unit: 'm2' }],
      },
      {
        version: '2024',
        effectiveFrom: '2024-01-01',
        effectiveTo: '2025-01-01',
        rules: [{ name: 'coating', type: 'area', unitPrice: 8, unit: 'm2' }],
      },
      {
        version: '2025',
        effectiveFrom: '2025-01-01',
        effectiveTo: '2026-01-01',
        rules: [
          { name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' },
          { name: 'summer-promo', type: 'piece', unitPrice: 5, unit: 'piece' },
        ],
      },
    ],
  });

  const input = { rule: 'coating', dimensions: { width: 2, height: 3 }, quantity: 1 };

  describe('resolution', () => {
    it('resolves a date inside the earliest price list', () => {
      const result = engine.calculate({ ...input, date: '2024-06-15' });

      expect(result.unitPrice).toBe(8);
      expect(result.total).toBe(48);
    });

    it('resolves a date inside a middle price list', () => {
      const result = engine.calculate({ ...input, date: '2025-06-15' });

      expect(result.unitPrice).toBe(10);
      expect(result.total).toBe(60);
    });

    it('resolves a date inside the open-ended price list', () => {
      const result = engine.calculate({ ...input, date: '2026-06-15' });

      expect(result.unitPrice).toBe(12);
      expect(result.total).toBe(72);
    });

    it('resolves a far-future date to the open-ended price list', () => {
      expect(engine.calculate({ ...input, date: '2999-12-31' }).unitPrice).toBe(12);
    });

    it('looks up rules only within the resolved price list', () => {
      expect(() =>
        engine.calculate({ rule: 'summer-promo', dimensions: {}, quantity: 1, date: '2026-06-15' }),
      ).toThrow('Unknown rule: "summer-promo"');
    });

    it('resolves a rule that exists only in an older price list', () => {
      const result = engine.calculate({
        rule: 'summer-promo',
        dimensions: {},
        quantity: 4,
        date: '2025-06-15',
      });

      expect(result.total).toBe(20);
    });
  });

  describe('window boundaries', () => {
    // The 2024/2025 boundary is shared, so this also proves effectiveTo is exclusive.
    it('treats effectiveFrom as inclusive', () => {
      expect(engine.calculate({ ...input, date: '2025-01-01' }).unitPrice).toBe(10);
    });

    it('includes the last day before effectiveTo', () => {
      expect(engine.calculate({ ...input, date: '2024-12-31' }).unitPrice).toBe(8);
    });

    it('resolves adjacent windows with no gap at the join date', () => {
      expect(engine.calculate({ ...input, date: '2026-01-01' }).unitPrice).toBe(12);
    });
  });

  describe('date input', () => {
    it('accepts an ISO date string', () => {
      expect(engine.calculate({ ...input, date: '2025-06-15' }).unitPrice).toBe(10);
    });

    it('accepts a Date object', () => {
      expect(engine.calculate({ ...input, date: new Date('2025-06-15') }).unitPrice).toBe(10);
    });

    // Boundaries are UTC midnight, so a time component must not spill into the next list.
    it('accepts a Date with a time component', () => {
      expect(
        engine.calculate({ ...input, date: new Date('2025-12-31T23:59:59.999Z') }).unitPrice,
      ).toBe(10);
    });

    // Rejected by z.coerce.date() before the engine can build an Invalid Date.
    it('rejects an unparsable date', () => {
      expect(() => engine.calculate({ ...input, date: 'not-a-date' })).toThrow(/date/i);
    });
  });

  describe('default date', () => {
    // Open-ended from a long-past date, so "now" always lands in it.
    const currentEngine = new PricingEngine({
      priceLists: [
        {
          version: 'archive',
          effectiveFrom: '2000-01-01',
          effectiveTo: '2001-01-01',
          rules: [{ name: 'coating', type: 'area', unitPrice: 5, unit: 'm2' }],
        },
        {
          version: 'current',
          effectiveFrom: '2001-01-01',
          rules: [{ name: 'coating', type: 'area', unitPrice: 12, unit: 'm2' }],
        },
      ],
    });

    it('falls back to the current date when date is omitted', () => {
      expect(currentEngine.calculate(input).unitPrice).toBe(12);
    });
  });

  describe('no effective price list', () => {
    // Both windows closed and separated by a gap: the only way to test "before" and "after".
    const gapEngine = new PricingEngine({
      priceLists: [
        {
          version: 'spring',
          effectiveFrom: '2026-03-01',
          effectiveTo: '2026-06-01',
          rules: [{ name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' }],
        },
        {
          version: 'autumn',
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-12-01',
          rules: [{ name: 'coating', type: 'area', unitPrice: 14, unit: 'm2' }],
        },
      ],
    });

    it('throws for a date before every price list', () => {
      expect(() => gapEngine.calculate({ ...input, date: '2026-01-15' })).toThrow(
        'No price list is effective on 2026-01-15',
      );
    });

    it('throws for a date inside a gap between price lists', () => {
      expect(() => gapEngine.calculate({ ...input, date: '2026-07-15' })).toThrow(
        'No price list is effective on 2026-07-15',
      );
    });

    it('throws for a date after every price list', () => {
      expect(() => gapEngine.calculate({ ...input, date: '2026-12-01' })).toThrow(
        'No price list is effective on 2026-12-01',
      );
    });

    it('reports the missing date normalized to ISO regardless of input format', () => {
      expect(() =>
        gapEngine.calculate({ ...input, date: new Date('2026-07-15T18:30:00Z') }),
      ).toThrow('No price list is effective on 2026-07-15');
    });
  });

  // Versioning only selects the rule set; everything after resolution is the v0.3 pipeline.
  describe('full pipeline within a resolved price list', () => {
    const pipelineEngine = new PricingEngine({
      priceLists: [
        {
          version: '2025',
          effectiveFrom: '2025-01-01',
          effectiveTo: '2026-01-01',
          rules: [
            {
              name: 'coating',
              type: 'area',
              unitPrice: 12.5,
              unit: 'm2',
              minCharge: 50,
              adjustments: [{ name: 'sale', type: 'percentage', value: -10 }],
            },
          ],
        },
        {
          version: '2026',
          effectiveFrom: '2026-01-01',
          rules: [
            {
              name: 'coating',
              type: 'area',
              unitPrice: 20,
              unit: 'm2',
              minCharge: 200,
              adjustments: [{ name: 'rush', type: 'fixed', value: 15 }],
            },
          ],
        },
      ],
    });

    it('applies adjustments and quantity from the older price list', () => {
      expect(
        pipelineEngine.calculate({
          rule: 'coating',
          dimensions: { width: 2, height: 3 },
          quantity: 2,
          date: '2025-06-01',
        }),
      ).toEqual({
        rule: 'coating',
        measure: 6,
        unitPrice: 12.5,
        subtotal: 75,
        adjustments: [{ name: 'sale', type: 'percentage', value: -10, amount: -7.5 }],
        adjusted: 67.5,
        quantity: 2,
        total: 135,
      });
    });

    it('applies minCharge and adjustments from the newer price list', () => {
      expect(
        pipelineEngine.calculate({
          rule: 'coating',
          dimensions: { width: 1, height: 1 },
          quantity: 2,
          date: '2026-06-01',
        }),
      ).toEqual({
        rule: 'coating',
        measure: 1,
        unitPrice: 20,
        subtotal: 200,
        adjustments: [{ name: 'rush', type: 'fixed', value: 15, amount: 15 }],
        adjusted: 215,
        quantity: 2,
        total: 430,
      });
    });
  });
});

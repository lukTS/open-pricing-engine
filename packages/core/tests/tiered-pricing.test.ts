import { describe, expect, it } from 'vitest';
import { PricingEngine, type PricingTiers } from '../src/index.js';

const tieredEngine = (tiers: PricingTiers) =>
  new PricingEngine({ rules: [{ name: 'coating', type: 'area', unit: 'm2', tiers }] });

describe('volume tier pricing', () => {
  const engine = tieredEngine({
    mode: 'volume',
    bands: [{ upTo: 2, unitPrice: 15 }, { upTo: 5, unitPrice: 12 }, { unitPrice: 10 }],
  });

  it('prices a measure inside the first band at its rate', () => {
    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 1, height: 1.5 },
      quantity: 1,
    });

    expect(result.unitPrice).toBe(15);
    expect(result.subtotal).toBe(22.5);
  });

  it('prices the whole measure at the rate of the band it falls into', () => {
    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 2 },
      quantity: 1,
    });

    expect(result.unitPrice).toBe(12);
    expect(result.subtotal).toBe(48);
  });

  it('treats upTo as inclusive', () => {
    const atFirstBound = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 1 },
      quantity: 1,
    });
    const atSecondBound = engine.calculate({
      rule: 'coating',
      dimensions: { width: 5, height: 1 },
      quantity: 1,
    });

    expect(atFirstBound.unitPrice).toBe(15);
    expect(atFirstBound.subtotal).toBe(30);
    expect(atSecondBound.unitPrice).toBe(12);
    expect(atSecondBound.subtotal).toBe(60);
  });

  it('prices a measure above the top bound in the open-ended band', () => {
    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 3, height: 3 },
      quantity: 1,
    });

    expect(result.unitPrice).toBe(10);
    expect(result.subtotal).toBe(90);
  });

  it('keeps the per-item measure as the default basis', () => {
    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 2 },
      quantity: 3,
    });

    expect(result.unitPrice).toBe(12);
    expect(result.subtotal).toBe(48);
    expect(result.total).toBe(144);
  });

  it('allows ascending (surcharge) rates', () => {
    const surcharge = tieredEngine({
      mode: 'volume',
      bands: [{ upTo: 2, unitPrice: 10 }, { unitPrice: 14 }],
    });

    const result = surcharge.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 2 },
      quantity: 1,
    });

    expect(result.unitPrice).toBe(14);
    expect(result.subtotal).toBe(56);
  });

  it('prices a single-band table exactly like a flat unitPrice', () => {
    const input = { rule: 'coating', dimensions: { width: 2, height: 3 }, quantity: 2 };
    const flat = new PricingEngine({
      rules: [{ name: 'coating', type: 'area', unit: 'm2', unitPrice: 12.5 }],
    });
    const singleBand = tieredEngine({ mode: 'volume', bands: [{ unitPrice: 12.5 }] });

    expect(singleBand.calculate(input)).toStrictEqual(flat.calculate(input));
  });
});

describe('tier options not supported yet', () => {
  const input = { rule: 'coating', dimensions: { width: 2, height: 3 }, quantity: 1 };

  it('does not price graduated tiers yet', () => {
    const engine = tieredEngine({ mode: 'graduated', bands: [{ unitPrice: 12 }] });

    expect(() => engine.calculate(input)).toThrow(
      'Rule "coating": graduated tier pricing is not supported yet',
    );
  });

  it('does not price the "total" tier basis yet', () => {
    const engine = tieredEngine({ mode: 'volume', basis: 'total', bands: [{ unitPrice: 12 }] });

    expect(() => engine.calculate(input)).toThrow(
      'Rule "coating": the "total" tier basis is not supported yet',
    );
  });
});

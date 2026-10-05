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

describe('graduated tier pricing', () => {
  const bands = [{ upTo: 2, unitPrice: 15 }, { upTo: 5, unitPrice: 12 }, { unitPrice: 10 }];
  const engine = tieredEngine({ mode: 'graduated', bands });

  it('prices a measure inside the first band at its rate', () => {
    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 1, height: 1.5 },
      quantity: 1,
    });

    expect(result.unitPrice).toBe(15);
    expect(result.subtotal).toBe(22.5);
  });

  it('prices each portion of a measure spanning two bands at its own rate', () => {
    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 2 },
      quantity: 1,
    });

    // 2 × 15 + 2 × 12 = 54 → blended 54 / 4
    expect(result.unitPrice).toBe(13.5);
    expect(result.subtotal).toBe(54);
  });

  it('prices a measure spanning every band, including the open-ended one', () => {
    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 3, height: 3 },
      quantity: 1,
    });

    // 2 × 15 + 3 × 12 + 4 × 10 = 106 → blended 106 / 9
    expect(result.unitPrice).toBeCloseTo(106 / 9);
    expect(result.subtotal).toBe(106);
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
    // 2 × 15 + 3 × 12 = 66 → blended 66 / 5
    expect(atSecondBound.unitPrice).toBe(13.2);
    expect(atSecondBound.subtotal).toBe(66);
  });

  it('prices a single-band table exactly like a flat unitPrice', () => {
    const input = { rule: 'coating', dimensions: { width: 2, height: 3 }, quantity: 2 };
    const flat = new PricingEngine({
      rules: [{ name: 'coating', type: 'area', unit: 'm2', unitPrice: 12.5 }],
    });
    const singleBand = tieredEngine({ mode: 'graduated', bands: [{ unitPrice: 12.5 }] });

    expect(singleBand.calculate(input)).toStrictEqual(flat.calculate(input));
  });

  it('charges a different total than volume mode on the same bands', () => {
    const input = { rule: 'coating', dimensions: { width: 3, height: 3 }, quantity: 1 };
    const volume = tieredEngine({ mode: 'volume', bands });

    expect(engine.calculate(input).total).toBe(106);
    expect(volume.calculate(input).total).toBe(90);
  });
});

describe('tier options not supported yet', () => {
  const input = { rule: 'coating', dimensions: { width: 2, height: 3 }, quantity: 1 };

  it('does not price the "total" tier basis yet', () => {
    const engine = tieredEngine({ mode: 'volume', basis: 'total', bands: [{ unitPrice: 12 }] });

    expect(() => engine.calculate(input)).toThrow(
      'Rule "coating": the "total" tier basis is not supported yet',
    );
  });
});

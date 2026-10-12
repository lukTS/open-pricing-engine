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

describe('tier basis', () => {
  const bands = [{ upTo: 10, unitPrice: 15 }, { upTo: 50, unitPrice: 12 }, { unitPrice: 10 }];
  // 20 panels × 3 m² = 60 m² on the whole line
  const input = { rule: 'coating', dimensions: { width: 3, height: 1 }, quantity: 20 };

  it('prices a quantity discount on a piece rule, where the basis equals the quantity', () => {
    const engine = new PricingEngine({
      rules: [
        {
          name: 'label',
          type: 'piece',
          unit: 'piece',
          tiers: {
            mode: 'volume',
            basis: 'total',
            bands: [{ upTo: 99, unitPrice: 0.5 }, { unitPrice: 0.35 }],
          },
        },
      ],
    });

    const belowBreak = engine.calculate({ rule: 'label', dimensions: {}, quantity: 99 });
    const fromBreak = engine.calculate({ rule: 'label', dimensions: {}, quantity: 100 });

    expect(belowBreak.unitPrice).toBe(0.5);
    expect(belowBreak.total).toBe(49.5);
    expect(fromBreak.unitPrice).toBe(0.35);
    expect(fromBreak.subtotal).toBe(0.35);
    expect(fromBreak.total).toBe(35);
  });

  it('prices graduated bands against the whole line on an area rule', () => {
    const engine = tieredEngine({ mode: 'graduated', basis: 'total', bands });

    const result = engine.calculate(input);

    // 10 × 15 + 40 × 12 + 10 × 10 = 730 → blended 730 / 60, per item 730 / 20
    expect(result.measure).toBe(3);
    expect(result.unitPrice).toBeCloseTo(730 / 60);
    expect(result.subtotal).toBe(36.5);
    expect(result.total).toBe(730);
  });

  it('prices volume bands against the whole line on an area rule', () => {
    const engine = tieredEngine({ mode: 'volume', basis: 'total', bands });

    const result = engine.calculate(input);

    // 60 m² falls into the open-ended band → every m² at 10
    expect(result.unitPrice).toBe(10);
    expect(result.subtotal).toBe(30);
    expect(result.total).toBe(600);
  });

  it('charges a different total for the same table on each basis', () => {
    const perItem = tieredEngine({ mode: 'graduated', basis: 'measure', bands });
    const perLine = tieredEngine({ mode: 'graduated', basis: 'total', bands });

    // per item: 3 m² stays in the first band → 3 × 15 × 20
    expect(perItem.calculate(input).total).toBe(900);
    expect(perLine.calculate(input).total).toBe(730);
  });

  it('defaults to the "measure" basis when omitted', () => {
    const explicit = tieredEngine({ mode: 'graduated', basis: 'measure', bands });
    const omitted = tieredEngine({ mode: 'graduated', bands });

    expect(omitted.calculate(input)).toStrictEqual(explicit.calculate(input));
  });

  it('keeps the line total equal to the tiered amount without minCharge or adjustments', () => {
    const engine = tieredEngine({ mode: 'graduated', basis: 'total', bands });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 4.1, height: 1 },
      quantity: 3,
    });

    // 4.1 × 3 = 12.3 m²: 10 × 15 + 2.3 × 12 = 177.6
    expect(result.subtotal).toBeCloseTo(59.2);
    expect(result.total).toBeCloseTo(177.6);
  });
});

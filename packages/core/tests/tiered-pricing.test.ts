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

    const { appliedTiers, ...result } = singleBand.calculate(input);

    expect(result).toStrictEqual(flat.calculate(input));
    expect(appliedTiers).toStrictEqual([{ unitPrice: 12.5, measure: 6, amount: 75 }]);
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

    const { appliedTiers, ...result } = singleBand.calculate(input);

    expect(result).toStrictEqual(flat.calculate(input));
    expect(appliedTiers).toStrictEqual([{ unitPrice: 12.5, measure: 6, amount: 75 }]);
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

describe('applied tier breakdown', () => {
  const bands = [{ upTo: 2, unitPrice: 15 }, { upTo: 5, unitPrice: 12 }, { unitPrice: 10 }];

  it('reports a single entry covering the whole basis in volume mode', () => {
    const engine = tieredEngine({ mode: 'volume', bands });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 2 },
      quantity: 1,
    });

    expect(result.appliedTiers).toStrictEqual([{ upTo: 5, unitPrice: 12, measure: 4, amount: 48 }]);
  });

  it('omits upTo for the open-ended band', () => {
    const engine = tieredEngine({ mode: 'volume', bands });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 3, height: 3 },
      quantity: 1,
    });

    expect(result.appliedTiers).toStrictEqual([{ unitPrice: 10, measure: 9, amount: 90 }]);
  });

  it('reports one entry per band that received a portion in graduated mode', () => {
    const engine = tieredEngine({ mode: 'graduated', bands });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 2 },
      quantity: 1,
    });

    // the open-ended band received nothing and is omitted
    expect(result.appliedTiers).toStrictEqual([
      { upTo: 2, unitPrice: 15, measure: 2, amount: 30 },
      { upTo: 5, unitPrice: 12, measure: 2, amount: 24 },
    ]);
  });

  it('reports entries per whole line on the "total" basis', () => {
    const engine = tieredEngine({
      mode: 'graduated',
      basis: 'total',
      bands: [{ upTo: 10, unitPrice: 15 }, { upTo: 50, unitPrice: 12 }, { unitPrice: 10 }],
    });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 3, height: 1 },
      quantity: 20,
    });

    expect(result.appliedTiers).toStrictEqual([
      { upTo: 10, unitPrice: 15, measure: 10, amount: 150 },
      { upTo: 50, unitPrice: 12, measure: 40, amount: 480 },
      { unitPrice: 10, measure: 10, amount: 100 },
    ]);
  });

  it('keeps the sum of entry amounts equal to the tiered amount', () => {
    const engine = tieredEngine({ mode: 'graduated', bands });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 3.3, height: 2.7 },
      quantity: 1,
    });

    const sum = (result.appliedTiers ?? []).reduce((acc, tier) => acc + tier.amount, 0);

    expect(result.appliedTiers).toHaveLength(3);
    expect(sum).toBe(result.subtotal);
  });

  it('leaves an untiered result identical to the pre-v0.5 shape', () => {
    const engine = new PricingEngine({
      rules: [{ name: 'coating', type: 'area', unit: 'm2', unitPrice: 12 }],
    });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 3 },
      quantity: 2,
    });

    expect(result).toStrictEqual({
      rule: 'coating',
      measure: 6,
      unitPrice: 12,
      subtotal: 72,
      adjustments: [],
      adjusted: 72,
      quantity: 2,
      total: 144,
    });
  });
});

describe('tier boundaries with floating-point measures', () => {
  const bands = [{ upTo: 0.3, unitPrice: 20 }, { unitPrice: 15 }];
  // 0.1 × 3 is exactly 0.3 in decimal but 0.30000000000000004 in binary
  const onBound = { rule: 'coating', dimensions: { width: 0.1, height: 3 }, quantity: 1 };

  it('prices a measure on an inclusive bound in that band in volume mode', () => {
    const engine = tieredEngine({ mode: 'volume', bands });

    const result = engine.calculate(onBound);

    expect(result.unitPrice).toBe(20);
  });

  it('adds no near-zero portion to the next band in graduated mode', () => {
    const engine = tieredEngine({ mode: 'graduated', bands });

    const result = engine.calculate(onBound);

    expect(result.appliedTiers).toStrictEqual([
      { upTo: 0.3, unitPrice: 20, measure: 0.3, amount: 6 },
    ]);
  });

  it('prices a "total" basis on an inclusive bound in that band', () => {
    const engine = new PricingEngine({
      rules: [
        {
          name: 'profile',
          type: 'linear',
          unit: 'm',
          tiers: { mode: 'volume', basis: 'total', bands },
        },
      ],
    });

    const result = engine.calculate({ rule: 'profile', dimensions: { length: 0.1 }, quantity: 3 });

    expect(result.unitPrice).toBe(20);
  });

  it('still moves a measure genuinely above the bound to the next band', () => {
    const engine = tieredEngine({ mode: 'volume', bands });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 0.31, height: 1 },
      quantity: 1,
    });

    expect(result.unitPrice).toBe(15);
  });
});

describe('tiers with minCharge', () => {
  const bands = [{ upTo: 2, unitPrice: 15 }, { unitPrice: 12 }];

  it('raises a tiered subtotal below minCharge to the floor, per item', () => {
    const engine = new PricingEngine({
      rules: [
        {
          name: 'coating',
          type: 'area',
          unit: 'm2',
          tiers: { mode: 'graduated', bands },
          minCharge: 20,
        },
      ],
    });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 1, height: 1 },
      quantity: 3,
    });

    // 1 m² × 15 = 15 per item, below the floor of 20
    expect(result.unitPrice).toBe(15);
    expect(result.subtotal).toBe(20);
    expect(result.total).toBe(60);
    expect(result.appliedTiers).toStrictEqual([{ upTo: 2, unitPrice: 15, measure: 1, amount: 15 }]);
  });

  it('floors the per-item share of a "total" basis line, not the line itself', () => {
    const engine = new PricingEngine({
      rules: [
        {
          name: 'coating',
          type: 'area',
          unit: 'm2',
          tiers: { mode: 'graduated', basis: 'total', bands },
          minCharge: 20,
        },
      ],
    });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 1, height: 1 },
      quantity: 4,
    });

    // 4 m² on the line: 2 × 15 + 2 × 12 = 54 → 13.5 per item, below the floor of 20
    expect(result.subtotal).toBe(20);
    expect(result.total).toBe(80);
    expect(result.appliedTiers).toStrictEqual([
      { upTo: 2, unitPrice: 15, measure: 2, amount: 30 },
      { unitPrice: 12, measure: 2, amount: 24 },
    ]);
  });
});

describe('tiers with adjustments', () => {
  const bands = [{ upTo: 2, unitPrice: 15 }, { unitPrice: 12 }];

  it('applies a percentage adjustment to the tiered subtotal', () => {
    const engine = new PricingEngine({
      rules: [
        {
          name: 'coating',
          type: 'area',
          unit: 'm2',
          tiers: { mode: 'graduated', bands },
          adjustments: [{ name: 'priority', type: 'percentage', value: 10 }],
        },
      ],
    });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 2, height: 2 },
      quantity: 2,
    });

    // 2 × 15 + 2 × 12 = 54 → +10 % = 59.4 per item
    expect(result.subtotal).toBe(54);
    expect(result.adjustments).toStrictEqual([
      { name: 'priority', type: 'percentage', value: 10, amount: expect.closeTo(5.4) },
    ]);
    expect(result.adjusted).toBeCloseTo(59.4);
    expect(result.total).toBeCloseTo(118.8);
  });

  it('cascades adjustments over the tiered subtotal in declared order', () => {
    const engine = new PricingEngine({
      rules: [
        {
          name: 'coating',
          type: 'area',
          unit: 'm2',
          tiers: { mode: 'volume', basis: 'total', bands },
          adjustments: [
            { name: 'coupon', type: 'fixed', value: 4 },
            { name: 'priority', type: 'percentage', value: 10 },
          ],
        },
      ],
    });

    const result = engine.calculate({
      rule: 'coating',
      dimensions: { width: 3, height: 1 },
      quantity: 5,
    });

    // 15 m² on the line → every m² at 12; (36 + 4) × 1.1 = 44, percentage first would give 43.6
    expect(result.unitPrice).toBe(12);
    expect(result.subtotal).toBe(36);
    expect(result.adjustments).toStrictEqual([
      { name: 'coupon', type: 'fixed', value: 4, amount: 4 },
      { name: 'priority', type: 'percentage', value: 10, amount: expect.closeTo(4) },
    ]);
    expect(result.adjusted).toBeCloseTo(44);
    expect(result.total).toBeCloseTo(220);
  });
});

describe('tiers with price list versioning', () => {
  const engine = new PricingEngine({
    priceLists: [
      {
        version: '2025',
        effectiveFrom: '2025-01-01',
        effectiveTo: '2026-01-01',
        rules: [{ name: 'coating', type: 'area', unit: 'm2', unitPrice: 12 }],
      },
      {
        version: '2026',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2027-01-01',
        rules: [
          {
            name: 'coating',
            type: 'area',
            unit: 'm2',
            tiers: {
              mode: 'graduated',
              basis: 'total',
              bands: [{ upTo: 10, unitPrice: 15 }, { upTo: 50, unitPrice: 12 }, { unitPrice: 10 }],
            },
          },
        ],
      },
      {
        version: '2027',
        effectiveFrom: '2027-01-01',
        rules: [
          {
            name: 'coating',
            type: 'area',
            unit: 'm2',
            tiers: {
              mode: 'graduated',
              basis: 'total',
              bands: [{ upTo: 10, unitPrice: 16 }, { upTo: 50, unitPrice: 13 }, { unitPrice: 11 }],
            },
          },
        ],
      },
    ],
  });

  // 20 panels × 3 m² = 60 m² on the whole line
  const input = { rule: 'coating', dimensions: { width: 3, height: 1 }, quantity: 20 };

  it('resolves the tier table of the price list effective on the date', () => {
    const current = engine.calculate({ ...input, date: '2026-06-15' });
    const raised = engine.calculate({ ...input, date: '2027-06-15' });

    // 10 × 15 + 40 × 12 + 10 × 10 = 730
    expect(current.total).toBe(730);
    // 10 × 16 + 40 × 13 + 10 × 11 = 790
    expect(raised.subtotal).toBe(39.5);
    expect(raised.total).toBe(790);
    expect(raised.appliedTiers).toStrictEqual([
      { upTo: 10, unitPrice: 16, measure: 10, amount: 160 },
      { upTo: 50, unitPrice: 13, measure: 40, amount: 520 },
      { unitPrice: 11, measure: 10, amount: 110 },
    ]);
  });

  it('switches a rule from a flat unitPrice to a tier table between versions', () => {
    const flat = engine.calculate({ ...input, date: '2025-06-15' });
    const tiered = engine.calculate({ ...input, date: '2026-06-15' });

    expect(flat.unitPrice).toBe(12);
    expect(flat.total).toBe(720);
    expect(flat).not.toHaveProperty('appliedTiers');
    expect(tiered.unitPrice).toBeCloseTo(730 / 60);
    expect(tiered.appliedTiers).toHaveLength(3);
  });
});

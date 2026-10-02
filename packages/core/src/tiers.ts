import type { PricingTiers } from './types.js';

/** Tiered amount for a basis value and the effective rate it was charged at. */
export type TierPrice = {
  amount: number;
  unitPrice: number;
};

/** Prices a basis value against a tier table (ADR 0003 §3). */
export const priceByTiers = (basisValue: number, tiers: PricingTiers): TierPrice => {
  // upTo is inclusive; the open-ended last band catches everything above the table.
  const band = tiers.bands.find((b) => b.upTo === undefined || basisValue <= b.upTo);
  /* v8 ignore next 3 -- unreachable: the schema requires an open-ended last band */
  if (!band) {
    throw new Error('Tier table has no open-ended band');
  }

  return { amount: basisValue * band.unitPrice, unitPrice: band.unitPrice };
};

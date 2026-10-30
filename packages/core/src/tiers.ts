import type { AppliedTier, PricingTiers } from './types.js';

/** Tiered amount for a basis value, the effective rate it was charged at and its band breakdown. */
export type TierPrice = {
  amount: number;
  unitPrice: number;
  appliedTiers: AppliedTier[];
};

/** Prices a basis value against a tier table (ADR 0003 §3). */
export const priceByTiers = (basisValue: number, tiers: PricingTiers): TierPrice => {
  // 15 significant digits strip binary noise: 0.1 * 3 = 0.30000000000000004 becomes 0.3 again.
  const basis = Number(basisValue.toPrecision(15));

  // Graduated mode prices each portion of the basis in its own band, like tax brackets.
  if (tiers.mode === 'graduated') {
    let amount = 0;
    let previousUpTo = 0;
    const appliedTiers: AppliedTier[] = [];

    for (const band of tiers.bands) {
      const currentUpTo = band.upTo ?? Infinity;
      const portion = Math.min(basis, currentUpTo) - previousUpTo;
      previousUpTo = currentUpTo;

      if (portion <= 0) {
        continue;
      }

      const bandAmount = portion * band.unitPrice;
      amount += bandAmount;
      appliedTiers.push({
        ...(band.upTo !== undefined ? { upTo: band.upTo } : {}),
        unitPrice: band.unitPrice,
        measure: portion,
        amount: bandAmount,
      });
    }

    return {
      amount,
      unitPrice: amount / basis,
      appliedTiers,
    };
  }

  // Volume mode: upTo is inclusive; the open-ended last band catches everything above the table.
  const band = tiers.bands.find((b) => b.upTo === undefined || basis <= b.upTo);
  /* v8 ignore next 3 -- unreachable: the schema requires an open-ended last band */
  if (!band) {
    throw new Error('Tier table has no open-ended band');
  }

  const amount = basis * band.unitPrice;

  return {
    amount,
    unitPrice: band.unitPrice,
    appliedTiers: [
      {
        ...(band.upTo !== undefined ? { upTo: band.upTo } : {}),
        unitPrice: band.unitPrice,
        measure: basis,
        amount,
      },
    ],
  };
};

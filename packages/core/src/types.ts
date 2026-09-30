/** Single pricing rule within the engine config. */
export type PricingRuleConfig = {
  /** Unique rule identifier, e.g. "flat-panel" */
  name: string;
  /** Calculation type, e.g. "area" */
  type: string;
  /** Price per unit of measurement; exactly one of `unitPrice` / `tiers` must be set */
  unitPrice?: number;
  /** Tier table replacing the flat `unitPrice`; exactly one of `unitPrice` / `tiers` must be set */
  tiers?: PricingTiers;
  /** Unit of measurement, e.g. "m2", "piece" */
  unit: string;
  /** If the calculated subtotal is below this value, it will be used instead */
  minCharge?: number;
  /** Price adjustments applied after subtotal calculation */
  adjustments?: Adjustment[];
};

/** Dimensions used by calculation strategies; each strategy reads the fields it needs. */
export type CalculationDimensions = {
  width?: number;
  height?: number;
  depth?: number;
  length?: number;
  weight?: number;
  hours?: number;
};

/** Input passed to the engine's calculate method. */
export type CalculationInput = {
  /** Name of the rule to apply */
  rule: string;
  /** Dimensions passed to the calculation strategy */
  dimensions: CalculationDimensions;
  /** Number of items */
  quantity: number;
  /** Date used to resolve the active price list; defaults to the current date */
  date?: Date | string;
};

/** Result returned after price calculation. */
export type CalculationResult = {
  /** Rule that was used */
  rule: string;
  /** Computed measure (strategy-dependent: area, length, volume, etc.) */
  measure: number;
  /** Price per unit from the matched rule */
  unitPrice: number;
  /** measure × unitPrice (or minCharge if higher) */
  subtotal: number;
  /** Number of items */
  quantity: number;
  /** subtotal × quantity */
  total: number;
  /** Applied adjustments with calculated amounts (empty array if none) */
  adjustments: AppliedAdjustment[];
  /** Subtotal after all adjustments applied (equals subtotal if none) */
  adjusted: number;
};

/** Versioned price list with rules active during a specific date range. */
export type PriceList = {
  /** Human-readable version label, e.g. "2026-Q1" */
  version: string;
  /** Start date when this price list becomes active, inclusive (ISO format: YYYY-MM-DD) */
  effectiveFrom: string;
  /** End date when this price list stops being active, exclusive (ISO format: YYYY-MM-DD) */
  effectiveTo?: string;
  /** Pricing rules included in this price list */
  rules: PricingRuleConfig[];
};

/** Top-level config passed to PricingEngine. */
export type PricingEngineConfig =
  | { rules: PricingRuleConfig[] } // legacy (v0.1–v0.3)
  | { priceLists: PriceList[] }; // versioned (v0.4+)

/** Adjustment rule (discount or surcharge) */
export type Adjustment = {
  /** Adjustment identifier, e.g. "bulk-discount" */
  name: string;
  /** percentage: relative to subtotal, fixed: absolute amount */
  type: 'percentage' | 'fixed';
  /** Adjustment value (-10 = -10% or -10€, +15 = +15% or +15€) */
  value: number;
};

/** Adjustment with calculated amount after applying to subtotal */
export type AppliedAdjustment = Adjustment & { amount: number };

/** One bracket of a tier table. */
export type TierBand = {
  /** Inclusive upper bound of this band; omitted on the last (open-ended) band */
  upTo?: number;
  /** Rate charged for the portion of the basis inside this band */
  unitPrice: number;
};

/** Tier table: the rate depends on how much is being priced. */
export type PricingTiers = {
  /** volume: one band rate for the whole basis, graduated: each portion priced in its own band */
  mode: 'volume' | 'graduated';
  /** What the bands are measured against: a single item (default "measure") or the whole line */
  basis?: 'measure' | 'total';
  /** Bands ordered by ascending `upTo`; the last one is open-ended */
  bands: TierBand[];
};

/** Tier band with the portion of the basis it priced. */
export type AppliedTier = {
  /** Upper bound of the band as configured; omitted for the open-ended top band */
  upTo?: number;
  /** Rate charged for this band's portion */
  unitPrice: number;
  /** Portion of the tier basis charged at this rate */
  measure: number;
  /** measure × unitPrice */
  amount: number;
};

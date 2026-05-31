/** Single pricing rule within the engine config. */
export type PricingRuleConfig = {
  /** Unique rule identifier, e.g. "flat-panel" */
  name: string;
  /** Calculation type, e.g. "area" */
  type: string;
  /** Price per unit of measurement */
  unitPrice: number;
  /** Unit of measurement, e.g. "m2", "piece" */
  unit: string;
  /** If the calculated subtotal is below this value, it will be used instead */
  minCharge?: number;
  /** Price adjustments applied after subtotal calculation */
  adjustments?: Adjustment[];
}

/** Width and height used to compute area. */
export type CalculationDimensions = {
  width: number;
  height: number;
}

/** Input passed to the engine's calculate method. */
export type CalculationInput = {
  /** Name of the rule to apply */
  rule: string;
  /** Dimensions for area calculation */
  dimensions: CalculationDimensions;
  /** Number of items */
  quantity: number;
}

/** Result returned after price calculation. */
export type CalculationResult = {
  /** Rule that was used */
  rule: string;
  /** Computed area (width × height) */
  area: number;
  /** Price per unit from the matched rule */
  unitPrice: number;
  /** area × unitPrice (or minCharge if higher) */
  subtotal: number;
  /** Number of items */
  quantity: number;
  /** subtotal × quantity */
  total: number;
  /** Applied adjustments with calculated amounts */
  adjustments?: AppliedAdjustment[];
  /** Subtotal after all adjustments applied */
  adjusted?: number;
}

/** Top-level config passed to PricingEngine. */
export interface PricingEngineConfig {
  rules: PricingRuleConfig[];
}

/** Adjustment rule (discount or surcharge) */
export type Adjustment = {
  /** Adjustment identifier, e.g. "bulk-discount" */
  name: string;
  /** percentage: relative to subtotal, fixed: absolute amount */
  type: 'percentage' | 'fixed';
  /** Adjustment value (-10 = -10% or -10€, +15 = +15% or +15€) */
  value: number;
}

/** Adjustment with calculated amount after applying to subtotal */
export type AppliedAdjustment = Adjustment & { amount: number }

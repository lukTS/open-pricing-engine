import type { CalculationDimensions } from '../types.js';

/** Contract for a calculation strategy: computes a measure from dimensions. */
export type CalculationStrategy = {
  /** Computes the measure (e.g. area, length) from the given dimensions. */
  measure: (d: CalculationDimensions) => number;
  /** Dimension fields this strategy needs; used for validation. */
  requiredFields: (keyof CalculationDimensions)[];
};

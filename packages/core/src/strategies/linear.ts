import type { CalculationStrategy } from './types.js';

/** Length-based strategy: uses the length value. */
export const linear: CalculationStrategy = {
  measure: (d) => d.length ?? 0,
  requiredFields: ['length'],
};

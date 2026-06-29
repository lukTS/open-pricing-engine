import type { CalculationStrategy } from './types.js';

/** Weight-based strategy: uses the weight value. */
export const weight: CalculationStrategy = {
  measure: (d) => d.weight ?? 0,
  requiredFields: ['weight'],
};

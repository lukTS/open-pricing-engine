import type { CalculationStrategy } from './types.js';

/** Time-based strategy: uses the hours value. */
export const time: CalculationStrategy = {
  measure: (d) => d.hours ?? 0,
  requiredFields: ['hours'],
};

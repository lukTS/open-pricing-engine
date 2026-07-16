import type { CalculationStrategy } from './types.js';

/** Time-based strategy: uses the hours value. */
export const time: CalculationStrategy = {
  /* v8 ignore next -- `?? 0` fallback is unreachable: dimensions are validated before measure() */
  measure: (d) => d.hours ?? 0,
  requiredFields: ['hours'],
};

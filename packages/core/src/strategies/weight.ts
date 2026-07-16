import type { CalculationStrategy } from './types.js';

/** Weight-based strategy: uses the weight value. */
export const weight: CalculationStrategy = {
  /* v8 ignore next -- `?? 0` fallback is unreachable: dimensions are validated before measure() */
  measure: (d) => d.weight ?? 0,
  requiredFields: ['weight'],
};

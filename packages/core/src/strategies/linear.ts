import type { CalculationStrategy } from './types.js';

/** Length-based strategy: uses the length value. */
export const linear: CalculationStrategy = {
  /* v8 ignore next -- `?? 0` fallback is unreachable: dimensions are validated before measure() */
  measure: (d) => d.length ?? 0,
  requiredFields: ['length'],
};

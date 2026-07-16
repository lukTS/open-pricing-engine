import type { CalculationStrategy } from './types.js';

/** Area-based strategy: width × height. */
export const area: CalculationStrategy = {
  /* v8 ignore next -- `?? 0` fallbacks are unreachable: dimensions are validated before measure() */
  measure: (d) => (d.width ?? 0) * (d.height ?? 0),
  requiredFields: ['width', 'height'],
};

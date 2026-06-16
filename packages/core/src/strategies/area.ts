import type { CalculationStrategy } from './types.js';

/** Area-based strategy: width × height. */
export const area: CalculationStrategy = {
  measure: (d) => (d.width ?? 0) * (d.height ?? 0),
  requiredFields: ['width', 'height'],
};

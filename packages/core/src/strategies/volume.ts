import type { CalculationStrategy } from './types.js';

/** Volume-based strategy: width × height × depth. */
export const volume: CalculationStrategy = {
  measure: (d) => (d.width ?? 0) * (d.height ?? 0) * (d.depth ?? 0),
  requiredFields: ['width', 'height', 'depth'],
};

import type { CalculationStrategy } from './types.js';

/** Piece-based strategy: fixed measure of 1 (subtotal = unitPrice). */
export const piece: CalculationStrategy = {
  measure: () => 1,
  requiredFields: [],
};

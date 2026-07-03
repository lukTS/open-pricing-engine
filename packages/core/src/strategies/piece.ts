import type { CalculationStrategy } from './types.js';

/**
 * Piece-based strategy: fixed measure of 1 (subtotal = unitPrice).
 * Models a per-unit item price (e.g. bolts, labels) — use `flat` for fixed service fees.
 */
export const piece: CalculationStrategy = {
  measure: () => 1,
  requiredFields: [],
};

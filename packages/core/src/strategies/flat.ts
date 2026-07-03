import type { CalculationStrategy } from './types.js';

/**
 * Flat-rate strategy: fixed measure of 1 (subtotal = unitPrice).
 * Models a fixed service fee (e.g. delivery, setup charge) — use `piece` for per-unit items.
 */
export const flat: CalculationStrategy = {
  measure: () => 1,
  requiredFields: [],
};

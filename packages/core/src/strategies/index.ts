import { area } from './area.js';
import { linear } from './linear.js';
import type { CalculationStrategy } from './types.js';

/** Registry of available calculation strategies, keyed by rule type. */
export const strategies: Record<string, CalculationStrategy> = {
  area,
  linear,
};

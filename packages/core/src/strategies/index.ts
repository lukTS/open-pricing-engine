import { area } from './area.js';
import { flat } from './flat.js';
import { linear } from './linear.js';
import { piece } from './piece.js';
import { time } from './time.js';
import type { CalculationStrategy } from './types.js';
import { volume } from './volume.js';
import { weight } from './weight.js';

/** Registry of available calculation strategies, keyed by rule type. */
export const strategies: Record<string, CalculationStrategy> = {
  area,
  linear,
  volume,
  weight,
  piece,
  flat,
  time,
};

import { CalculationInputSchema, PricingEngineConfigSchema } from './schemas.js';
import type {
  AppliedAdjustment,
  CalculationInput,
  CalculationResult,
  PricingEngineConfig,
} from './types.js';

export class PricingEngine {
  private rules: PricingEngineConfig['rules'];

  constructor(config: PricingEngineConfig) {
    PricingEngineConfigSchema.parse(config);
    this.rules = config.rules;
  }

  calculate(input: CalculationInput): CalculationResult {
    CalculationInputSchema.parse(input);

    const rule = this.rules.find((r) => r.name === input.rule);
    if (!rule) {
      throw new Error(`Unknown rule: "${input.rule}"`);
    }

    const area = (input.dimensions.width ?? 0) * (input.dimensions.height ?? 0);
    let subtotal = area * rule.unitPrice;

    if (rule.minCharge && subtotal < rule.minCharge) {
      subtotal = rule.minCharge;
    }

    let adjusted = subtotal;
    const appliedAdjustments: AppliedAdjustment[] = [];

    if (rule.adjustments) {
      for (const adj of rule.adjustments) {
        const amount = adj.type === 'percentage' ? adjusted * (adj.value / 100) : adj.value;
        adjusted += amount;
        appliedAdjustments.push({ ...adj, amount });
      }
    }

    const total = adjusted * input.quantity;

    return {
      rule: rule.name,
      area,
      unitPrice: rule.unitPrice,
      subtotal,
      adjustments: appliedAdjustments,
      adjusted,
      quantity: input.quantity,
      total,
    };
  }
}

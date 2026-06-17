import { CalculationInputSchema, PricingEngineConfigSchema } from './schemas.js';
import { strategies } from './strategies/index.js';
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

    const strategy = strategies[rule.type];
    if (!strategy) {
      throw new Error(`Unknown type: "${rule.type}"`);
    }

    const missing = strategy.requiredFields.filter((f) => !(f in input.dimensions));
    if (missing.length > 0) {
      throw new Error(`Missing fields: ${missing.join(', ')}`);
    }

    const measure = strategy.measure(input.dimensions);
    let subtotal = measure * rule.unitPrice;

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
      area: measure,
      unitPrice: rule.unitPrice,
      subtotal,
      adjustments: appliedAdjustments,
      adjusted,
      quantity: input.quantity,
      total,
    };
  }
}

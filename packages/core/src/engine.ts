import type { CalculationInput, CalculationResult, PricingEngineConfig } from './types.js';

export class PricingEngine {
  private rules: PricingEngineConfig['rules'];

  constructor(config: PricingEngineConfig) {
    this.rules = config.rules;
  }

  calculate(input: CalculationInput): CalculationResult {
    const rule = this.rules.find((r) => r.name === input.rule);

    if (!rule) {
      throw new Error(`Unknown rule: "${input.rule}"`);
    }

    const area = input.dimensions.width * input.dimensions.height;
    let subtotal = area * rule.unitPrice;

    if (rule.minCharge && subtotal < rule.minCharge) {
      subtotal = rule.minCharge;
    }

    const total = subtotal * input.quantity;
    
    return {
      rule: rule.name,
      area,
      unitPrice: rule.unitPrice,
      subtotal,
      quantity: input.quantity,
      total,
    };
  }
}
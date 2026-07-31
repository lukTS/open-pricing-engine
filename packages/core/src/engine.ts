import {
  CalculationInputSchema,
  dimensionSchemasByType,
  PricingEngineConfigSchema,
} from './schemas.js';
import { strategies } from './strategies/index.js';
import type {
  AppliedAdjustment,
  CalculationInput,
  CalculationResult,
  PricingEngineConfig,
  PricingRuleConfig,
} from './types.js';

/** Internal, always-resolved shape produced by the constructor from either config branch. */
type NormalizedPriceList = {
  version: string;
  from: number;
  to: number;
  rules: PricingRuleConfig[];
};

export class PricingEngine {
  private priceLists: NormalizedPriceList[];

  constructor(config: PricingEngineConfig) {
    PricingEngineConfigSchema.parse(config);

    // Legacy { rules } normalizes to one always-effective list, so calculate() has a single shape.
    this.priceLists =
      'rules' in config
        ? [{ version: 'default', from: -Infinity, to: Infinity, rules: config.rules }]
        : config.priceLists.map((list) => ({
            version: list.version,
            from: Date.parse(list.effectiveFrom),
            to: list.effectiveTo ? Date.parse(list.effectiveTo) : Infinity,
            rules: list.rules,
          }));
  }

  calculate(input: CalculationInput): CalculationResult {
    CalculationInputSchema.parse(input);

    const [priceList] = this.priceLists;
    /* v8 ignore next 3 -- unreachable: config validation guarantees at least one price list */
    if (!priceList) {
      throw new Error('No price list is effective');
    }

    const rule = priceList.rules.find((r) => r.name === input.rule);
    if (!rule) {
      throw new Error(`Unknown rule: "${input.rule}"`);
    }

    const strategy = strategies[rule.type];
    const dimensionsSchema = dimensionSchemasByType[rule.type];
    /* v8 ignore next 3 -- unreachable: rule.type is validated against the strategy registry at config time */
    if (!strategy || !dimensionsSchema) {
      throw new Error(`Unknown type: "${rule.type}"`);
    }

    // Per-strategy dimension validation (throws a descriptive ZodError).
    dimensionsSchema.parse(input.dimensions);

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
      measure,
      unitPrice: rule.unitPrice,
      subtotal,
      adjustments: appliedAdjustments,
      adjusted,
      quantity: input.quantity,
      total,
    };
  }
}

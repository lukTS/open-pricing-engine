import {
  CalculationInputSchema,
  dimensionSchemasByType,
  PricingEngineConfigSchema,
} from './schemas.js';
import { strategies } from './strategies/index.js';
import { priceByTiers } from './tiers.js';
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
        : config.priceLists
            .map((list) => ({
              version: list.version,
              from: Date.parse(list.effectiveFrom),
              to: list.effectiveTo ? Date.parse(list.effectiveTo) : Infinity,
              rules: list.rules,
            }))
            .sort((a, b) => a.from - b.from);
  }

  calculate(input: CalculationInput): CalculationResult {
    CalculationInputSchema.parse(input);

    const targetMs = input.date ? new Date(input.date).getTime() : Date.now();

    const priceList = this.priceLists.find((list) => list.from <= targetMs && list.to > targetMs);

    if (!priceList) {
      const isoDate = new Date(targetMs).toISOString().slice(0, 10);
      throw new Error(`No price list is effective on ${isoDate}`);
    }

    const rule = priceList.rules.find((r) => r.name === input.rule);
    if (!rule) {
      throw new Error(`Unknown rule: "${input.rule}"`);
    }

    // Temporary until #85 lands: the "total" basis validates but cannot be priced yet.
    if (rule.tiers?.basis === 'total') {
      throw new Error(`Rule "${rule.name}": the "total" tier basis is not supported yet`);
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

    // Tiered pricing replaces the flat rate; the rest of the pipeline is unchanged.
    const tierPrice = rule.tiers ? priceByTiers(measure, rule.tiers) : undefined;
    const unitPrice = tierPrice?.unitPrice ?? rule.unitPrice;
    /* v8 ignore next 3 -- unreachable: the schema requires exactly one of unitPrice / tiers */
    if (unitPrice === undefined) {
      throw new Error(`Rule "${rule.name}": must contain "unitPrice" or "tiers"`);
    }

    let subtotal = tierPrice?.amount ?? measure * unitPrice;

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
      unitPrice,
      subtotal,
      adjustments: appliedAdjustments,
      adjusted,
      quantity: input.quantity,
      total,
    };
  }
}

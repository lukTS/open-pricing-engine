import { z } from 'zod';
import { strategies } from './strategies/index.js';

export const AdjustmentSchema = z.discriminatedUnion('type', [
  z.object({
    name: z.string().min(1, 'Adjustment name is required'),
    type: z.literal('percentage'),
    value: z
      .number()
      .min(-100, 'Percentage cannot be less than -100')
      .max(100, 'Percentage cannot be greater than 100')
      .describe('Adjustment percentage (-100 to 100)'),
  }),
  z.object({
    name: z.string().min(1, 'Adjustment name is required'),
    type: z.literal('fixed'),
    value: z.number().describe('Fixed adjustment amount'),
  }),
]);

export const AdjustmentsSchema = z.array(AdjustmentSchema).superRefine((items, ctx) => {
  const names = new Set<string>();
  items.forEach((item, index) => {
    if (names.has(item.name)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Adjustment name must be unique',
        path: [index, 'name'],
      });
    }
    names.add(item.name);
  });
});

/** Known strategy types, derived from the registry — no manual list to keep in sync. */
export const RuleTypeSchema = z.enum(Object.keys(strategies) as [string, ...string[]]);

export const PricingRuleConfigSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  type: RuleTypeSchema,
  unitPrice: z.number().positive('unitPrice must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  minCharge: z.number().positive('minCharge must be positive').optional(),
  adjustments: AdjustmentsSchema.optional(),
});

export const CalculationDimensionsSchema = z.object({
  width: z.number().positive('Width must be positive').optional(),
  height: z.number().positive('Height must be positive').optional(),
  length: z.number().positive('Length must be positive').optional(),
  depth: z.number().positive('Depth must be positive').optional(),
  weight: z.number().positive('Weight must be positive').optional(),
  hours: z.number().positive('Hours must be positive').optional(),
});

export const CalculationInputSchema = z.object({
  rule: z.string().min(1, 'Rule name is required'),
  dimensions: CalculationDimensionsSchema,
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  date: z.coerce.date().optional(),
});

export const PriceListSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().optional(),
  rules: z.array(PricingRuleConfigSchema).min(1, 'At least one rule is required'),
});

export const PricingEngineConfigSchema = z.object({
  rules: z
    .array(PricingRuleConfigSchema)
    .min(1, 'At least one rule is required')
    .refine(
      (rules) => new Set(rules.map((r) => r.name)).size === rules.length,
      'Rule names must be unique',
    )
    .optional(),
  priceLists: z.array(PriceListSchema).min(1, 'At least one price list is required').optional(),
});

// --- Per-strategy dimension validation -------------------------------------

/** Validators per dimension field (message covers both "missing" and "not a number"). */
const dimensionValidators = {
  width: z.number('Width is required and must be a number').positive('Width must be positive'),
  height: z.number('Height is required and must be a number').positive('Height must be positive'),
  length: z.number('Length is required and must be a number').positive('Length must be positive'),
  depth: z.number('Depth is required and must be a number').positive('Depth must be positive'),
  weight: z.number('Weight is required and must be a number').positive('Weight must be positive'),
  hours: z.number('Hours is required and must be a number').positive('Hours must be positive'),
} as const;

type DimensionField = keyof typeof dimensionValidators;

const ALL_FIELDS = Object.keys(dimensionValidators) as DimensionField[];

/** Builds a dimensions schema where `requiredFields` are required, the rest optional. */
function buildDimensionsSchema(requiredFields: readonly DimensionField[]) {
  const shape = {} as Record<DimensionField, z.ZodTypeAny>;
  for (const field of ALL_FIELDS) {
    shape[field] = requiredFields.includes(field)
      ? dimensionValidators[field]
      : dimensionValidators[field].optional();
  }
  return z.object(shape);
}

/** Per-strategy dimension schemas, derived from each strategy's `requiredFields`. */
export const dimensionSchemasByType: Record<string, z.ZodTypeAny> = Object.fromEntries(
  Object.entries(strategies).map(([type, strategy]) => [
    type,
    buildDimensionsSchema(strategy.requiredFields as DimensionField[]),
  ]),
);

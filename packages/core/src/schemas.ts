import { z } from 'zod';

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

export const PricingRuleConfigSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  type: z.string().min(1, 'Rule type is required'),
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
});

export const PricingEngineConfigSchema = z.object({
  rules: z
    .array(PricingRuleConfigSchema)
    .min(1, 'At least one rule is required')
    .refine(
      (rules) => new Set(rules.map((r) => r.name)).size === rules.length,
      'Rule names must be unique',
    ),
});

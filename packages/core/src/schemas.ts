import { z } from 'zod';

export const PricingRuleConfigSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  type: z.string().min(1, 'Rule type is required'),
  unitPrice: z.number().positive('unitPrice must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  minCharge: z.number().positive('minCharge must be positive').optional(),
});

export const CalculationDimensionsSchema = z.object({
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive'),
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
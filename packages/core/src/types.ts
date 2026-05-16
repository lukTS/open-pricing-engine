export type PricingRuleConfig = {
  name: string;
  type: string;
  unitPrice: number;
  unit: string;
  minCharge?: number;
}

export type CalculationDimensions = {
  width: number;
  height: number;
}

export type CalculationInput = {
  rule: string;
  dimensions: CalculationDimensions;
  quantity: number;
}

export type CalculationResult = {
  rule: string;
  area: number;
  unitPrice: number;
  subtotal: number;
  quantity: number;
  total: number;
}

export interface PricingEngineConfig {
  rules: PricingRuleConfig[];
}
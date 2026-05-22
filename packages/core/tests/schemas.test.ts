import { describe, expect, it } from "vitest";
import { PricingEngine } from '../src/index.js';

describe('PricingRuleConfigSchema', () => {
  it('throws on empty rule name', () => {
    expect(() => new PricingEngine({
      rules: [ { name: '', type: 'area', unitPrice: 12.5, unit: 'm2', minCharge: 50 } ]
    })).toThrow();
  });

  it('throws on zero unitPrice', () => {
    expect(() => new PricingEngine({
      rules: [ {name: 'test', type: 'area', unitPrice: 0, unit: 'm2', minCharge: 50} ]
    })).toThrow();
  });

  it('throws on negative unitPrice', () => {
    expect(() => new PricingEngine({
      rules: [{ name: 'test', type: 'area', unitPrice: -30, unit: 'm2', minCharge: 50 }],
    })).toThrow();
  });

  it('throws on empty unit', () => {
    expect(() => new PricingEngine({
      rules: [{ name: 'test', type: 'area', unitPrice: 30, unit: '', minCharge: 50 }]
    })).toThrow();
  });

  it('throws on zero minCharge', () => {
    expect(() => new PricingEngine({
      rules: [{ name: 'test', type: 'area', unitPrice: 30, unit: 'm2', minCharge: 0 }],
    })).toThrow();
  });

  it('throws on negative minCharge', () => {
    expect(() => new PricingEngine({
      rules: [{ name: 'test', type: 'area', unitPrice: 30, unit: 'm2', minCharge: -50 }]
    })).toThrow();
  });

  it('throws if no rules are provided', () => {
    expect(() => new PricingEngine({ rules: [] })).toThrow();
  });

  it('throws if rule names are not unique', () => {
    expect(() => new PricingEngine({
      rules: [
        { name: 'duplicate', type: 'area', unitPrice: 30, unit: 'm2', minCharge: 50 },
        { name: 'duplicate', type: 'area', unitPrice: 25, unit: 'm2' },
      ]
    })).toThrow();
  }); 
});

describe('CalculationInputSchema', () => {
  const engine = new PricingEngine({
    rules: [
      { name: 'flat-surface', type: 'area', unitPrice: 12.5, unit: 'm2' },
      { name: 'premium', type: 'area', unitPrice: 30, unit: 'm2', minCharge: 50 },
    ],
  });

  it('throws on empty rule name in input', () => {
    expect(() => engine.calculate({
      rule: '',
      dimensions: { width: 2, height: 3 },
      quantity: 1,
    })).toThrow();
  });

  it('throws on zero quantity', () => {
    expect(() => engine.calculate({
      rule: 'flat-surface',
      dimensions: { width: 2, height: 3 },
      quantity: 0,
    })).toThrow();
  });

  it('throws on negative quantity', () => {
    expect(() => engine.calculate({
      rule: 'flat-surface',
      dimensions: { width: 2, height: 3 },
      quantity: -1,
    })).toThrow();
  });

  it('throws on negative width', () => {
    expect(() => engine.calculate({
      rule: 'flat-surface',
      dimensions: { width: -1, height: 3 },
      quantity: 1,
    })).toThrow();
  });

  it('throws on negative height', () => {
    expect(() => engine.calculate({
      rule: 'flat-surface',
      dimensions: { width: 2, height: -3 },
      quantity: 1,
    })).toThrow();
  });
  it('throws on zero width', () => {
    expect(() => engine.calculate({
      rule: 'flat-surface',
      dimensions: { width: 0, height: 3 },
      quantity: 1,
    })).toThrow();
  });

  it('throws on zero height', () => {
    expect(() => engine.calculate({
      rule: 'flat-surface',
      dimensions: { width: 2, height: 0 },
      quantity: 1,
    })).toThrow();
  });
});
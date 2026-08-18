# open-pricing-engine

[![npm version](https://img.shields.io/npm/v/open-pricing-engine)](https://www.npmjs.com/package/open-pricing-engine)
[![CI](https://github.com/lukTS/open-pricing-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/lukTS/open-pricing-engine/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A configurable, framework-agnostic pricing engine for any business domain.

## Install

```bash
npm install open-pricing-engine
```

## Usage

```typescript
import { PricingEngine } from 'open-pricing-engine';

const engine = new PricingEngine({
  rules: [
    {
      name: 'flat-surface',
      type: 'area',
      unitPrice: 12.5,
      unit: 'm2',
      minCharge: 25.0,
    },
  ],
});

const result = engine.calculate({
  rule: 'flat-surface',
  dimensions: { width: 2.0, height: 1.5 },
  quantity: 10,
});

// Result:
// {
//   rule: 'flat-surface',
//   measure: 3.0,
//   unitPrice: 12.50,
//   subtotal: 37.50,
//   adjustments: [],
//   adjusted: 37.50,
//   quantity: 10,
//   total: 375.00
// }
```

## Price list versioning

Rules can be grouped into **price lists**, each effective for a date range.
`calculate()` uses the list effective on the given `date` (defaults to now), so
the engine answers both "what does this cost today" and "what did this cost last
year".

```typescript
const engine = new PricingEngine({
  priceLists: [
    {
      version: '2025',
      effectiveFrom: '2025-01-01',
      effectiveTo: '2026-01-01', // exclusive → covers all of 2025
      rules: [{ name: 'coating', type: 'area', unitPrice: 10, unit: 'm2' }],
    },
    {
      version: '2026',
      effectiveFrom: '2026-01-01', // open-ended → the current price list
      rules: [{ name: 'coating', type: 'area', unitPrice: 12, unit: 'm2' }],
    },
  ],
});

const item = { rule: 'coating', dimensions: { width: 2, height: 1 }, quantity: 1 };

engine.calculate(item).unitPrice; // 12 — date omitted → today's price list
engine.calculate({ ...item, date: '2025-06-01' }).unitPrice; // 10 — historical quote
```

Dates are ISO calendar dates (`YYYY-MM-DD`) read as UTC midnight, and the window
is `[effectiveFrom, effectiveTo)` — start inclusive, end exclusive. Overlapping
windows are rejected when the engine is constructed. A plain `rules` config (as
in the example above) keeps working unchanged.

## Features

- **Config-driven** — define pricing rules in JSON
- **Multiple pricing strategies** — area, linear, volume, weight, time, piece, flat
- **Discounts & surcharges** — percentage and fixed adjustments, applied as a cascade
- **Minimum charge** — guaranteed price floor per item
- **Price list versioning** — date-effective price lists and historical quotes
- **TypeScript-first** — full type safety
- **Zod validation** — descriptive errors for invalid config
- **100% test coverage**

## Documentation

Full documentation, roadmap, and contributing guide: [GitHub](https://github.com/lukTS/open-pricing-engine)

## License

[MIT](https://github.com/lukTS/open-pricing-engine/blob/main/LICENSE)

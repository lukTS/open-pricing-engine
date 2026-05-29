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
      type: 'area-based',
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
//   area: 3.0,
//   unitPrice: 12.50,
//   subtotal: 37.50,
//   quantity: 10,
//   total: 375.00
// }
```

## Features

- **Config-driven** — define pricing rules in JSON
- **Area-based pricing** — calculations from dimensions (m², ft², units)
- **Minimum charge** — guaranteed price floor per item
- **TypeScript-first** — full type safety
- **Zod validation** — descriptive errors for invalid config
- **100% test coverage**

## Documentation

Full documentation, roadmap, and contributing guide: [GitHub](https://github.com/lukTS/open-pricing-engine)

## License

[MIT](https://github.com/lukTS/open-pricing-engine/blob/main/LICENSE)

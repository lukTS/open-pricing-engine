# Open Pricing Engine

[![CI](https://github.com/lukTS/open-pricing-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/lukTS/open-pricing-engine/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/open-pricing-engine)](https://www.npmjs.com/package/open-pricing-engine)
[![npm downloads](https://img.shields.io/npm/dm/open-pricing-engine)](https://www.npmjs.com/package/open-pricing-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

A configurable, framework-agnostic pricing engine for any business domain.

Define your pricing rules in a simple JSON config — the engine does the math.

## Why

Every business has pricing logic. Most teams build it from scratch, tightly coupled to their application. This engine extracts that logic into a **reusable, testable, configurable module**.

Born from real-world experience building ERP pricing systems — area-based calculations, tiered rates, minimum charges, discounts. Abstracted to work across any domain: manufacturing, logistics, SaaS, e-commerce.

## Features

- **Config-driven** — define pricing rules in JSON, no hardcoding
- **Area-based pricing** — calculations from dimensions (m², ft², units)
- **Minimum charge** — guaranteed price floor per item
- **Framework-agnostic** — pure TypeScript, runs anywhere
- **Minimal dependencies** — only Zod for validation
- **100% test coverage** — tested with Vitest
- **TypeScript-first** — full type safety, great DX

## Quick Start

```bash
npm install open-pricing-engine
```

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
//   subtotal: 37.50,    // 3.0 × 12.50
//   quantity: 10,
//   total: 375.00       // 37.50 × 10
// }
```

## Use Cases

The engine works for any business where price depends on item dimensions:

- Metal coating & powder painting (price per m²)
- CNC machining, laser cutting (price per area)
- Glass, flooring, fabric (price per m² with minimum charge)

Future versions will support tiered pricing, discounts, and custom formulas — see [Roadmap](#roadmap).

## Roadmap

| Version  | Scope                                           |
| -------- | ----------------------------------------------- |
| **v0.1** | Area-based pricing, JSON config, minimum charge |
| v0.2     | Discounts & surcharges (%, absolute)            |
| v0.3     | Price list versioning, effective dates          |
| v0.4     | REST API wrapper (Fastify)                      |
| v0.5     | Interactive playground (React)                  |
| v1.0     | Plugin system for custom formulas               |

## Project Structure

```
open-pricing-engine/
├── packages/
│   ├── core/          — pricing logic (npm package)
│   ├── api/           — REST API wrapper (planned)
│   └── playground/    — interactive demo (planned)
├── docs/              — architecture decisions
└── .github/workflows/ — CI/CD
```

## Development

```bash
# Prerequisites: Node.js 22+, pnpm 10+

pnpm install        # Install dependencies
pnpm test           # Run tests
pnpm typecheck      # Type-check
pnpm build          # Build
pnpm format         # Format code
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your branch (`git checkout -b feat/my-feature`)
3. Commit using [conventional commits](https://www.conventionalcommits.org/)
4. Open a Pull Request

## License

[MIT](LICENSE)

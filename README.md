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

The npm ecosystem has plenty of billing and payment platforms (subscriptions, invoicing, tax), but few dedicated, standalone pricing engines — especially ones that handle physical dimensions like area, length, volume or weight. This library focuses purely on the pricing calculation: typed, validated, framework-agnostic, with no dependency on any payment provider.

## Features

- **Config-driven** — define pricing rules in JSON, no hardcoding
- **Multiple pricing strategies** — area, linear, volume, weight, time, piece and flat
- **Discounts & surcharges** — percentage and fixed adjustments, applied as a cascade
- **Minimum charge** — guaranteed price floor per item
- **Price list versioning** — date-effective price lists for scheduled price changes and historical quotes
- **Per-strategy validation** — each strategy's required dimensions are checked with descriptive errors
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
//   subtotal: 37.50,        // 3.0 × 12.50
//   adjustments: [],        // no adjustments configured
//   adjusted: 37.50,        // subtotal after adjustments
//   quantity: 10,
//   total: 375.00           // 37.50 × 10
// }
```

## Strategies

The calculation type is chosen per rule via the `type` field. Each strategy
turns the input `dimensions` into a billable `measure`, then
`subtotal = measure × unitPrice`.

| `type`   | Required dimensions        | `measure`                | Example unit |
| -------- | -------------------------- | ------------------------ | ------------ |
| `area`   | `width`, `height`          | `width × height`         | m²           |
| `linear` | `length`                   | `length`                 | m            |
| `volume` | `width`, `height`, `depth` | `width × height × depth` | m³           |
| `weight` | `weight`                   | `weight`                 | kg           |
| `time`   | `hours`                    | `hours`                  | h            |
| `piece`  | —                          | `1` (per-unit item)      | pc           |
| `flat`   | —                          | `1` (fixed service fee)  | job          |

```typescript
const engine = new PricingEngine({
  rules: [
    { name: 'cable', type: 'linear', unitPrice: 3, unit: 'm' },
    { name: 'tank', type: 'volume', unitPrice: 8, unit: 'm3' },
    { name: 'setup', type: 'flat', unitPrice: 50, unit: 'job' },
  ],
});

engine.calculate({ rule: 'cable', dimensions: { length: 4 }, quantity: 1 }).measure; // 4
engine.calculate({ rule: 'tank', dimensions: { width: 2, height: 2, depth: 2 }, quantity: 1 })
  .measure; // 8
engine.calculate({ rule: 'setup', dimensions: {}, quantity: 1 }).measure; // 1
```

Missing required dimensions throw a descriptive validation error (for example,
a `volume` rule without `depth`).

## Price List Versioning

Prices change over time. Instead of a single flat `rules` array, a config can
declare **price lists** — each one a set of rules valid for a date range.
`calculate()` resolves the list effective on the given `date` (defaults to now)
and prices against its rules.

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

- `effectiveFrom` / `effectiveTo` are ISO calendar dates (`YYYY-MM-DD`), read as **UTC midnight**
- The window is `[effectiveFrom, effectiveTo)` — start inclusive, end exclusive, so consecutive lists join seamlessly
- Omitting `effectiveTo` leaves the list open-ended — the "current" price list
- `date` accepts a `Date` or an ISO string; when omitted it defaults to the current date
- The same rule name may repeat across versions — that is the point of versioning
- Overlapping windows, duplicate `version` labels and inverted ranges are rejected when the engine is constructed
- Gaps between windows are allowed; a date inside one throws `No price list is effective on <date>`

The classic `rules` config keeps working unchanged — it is treated as a single,
always-effective price list:

```typescript
const engine = new PricingEngine({
  rules: [{ name: 'coating', type: 'area', unitPrice: 12, unit: 'm2' }],
});
```

See [ADR 0002](docs/adr/0002-price-list-versioning.md) for the full rationale.

## Use Cases

The engine works for any business where price depends on item dimensions:

- Metal coating & powder painting (price per m²)
- CNC machining, laser cutting (price per area)
- Glass, flooring, fabric (price per m² with minimum charge)
- Any workflow that schedules price changes ahead or re-quotes past orders
  ("what would this order have cost last year")

Future versions will support tiered pricing and custom formulas — see [Roadmap](#roadmap).

## Roadmap

| Version  | Scope                                                       | Status   |
| -------- | ----------------------------------------------------------- | -------- |
| **v0.1** | Area-based pricing, JSON config, minimum charge             | Released |
| **v0.2** | Discounts & surcharges (%, absolute)                        | Released |
| **v0.3** | Calculation strategies (area, linear, volume, weight, etc.) | Released |
| **v0.4** | Price list versioning, effective dates                      | Released |
| v0.5     | Tiered pricing (volume & graduated)                         | Planned  |
| v0.6     | REST API wrapper (Fastify)                                  | Planned  |
| v0.7     | Interactive playground (React)                              | Planned  |
| v1.0     | Plugin system for custom formulas                           | Planned  |

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

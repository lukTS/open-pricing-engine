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
- **Tiered pricing** — volume and graduated rate bands, per item or per order line (quantity breaks)
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
`subtotal = measure × unitPrice` (or the measure is priced by a tier table —
see [Tiered Pricing](#tiered-pricing)).

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

## Tiered Pricing

A rule's rate can depend on **how much** is being priced. Instead of a flat
`unitPrice`, a rule can declare a **tier table** — a list of bands, each with an
inclusive upper bound `upTo` and the `unitPrice` charged inside it.

```typescript
const engine = new PricingEngine({
  rules: [
    {
      name: 'coating',
      type: 'area',
      unit: 'm2',
      tiers: {
        mode: 'graduated',
        basis: 'total', // the whole order line, not a single panel
        bands: [
          { upTo: 10, unitPrice: 15 }, // the first 10 m²
          { upTo: 50, unitPrice: 12 }, // the next 40 m²
          { unitPrice: 10 }, // everything above 50 m²
        ],
      },
    },
  ],
});

// 20 panels × 3 m² = 60 m² on the order line
const result = engine.calculate({
  rule: 'coating',
  dimensions: { width: 3, height: 1 },
  quantity: 20,
});

// Result:
// {
//   rule: 'coating',
//   measure: 3,
//   unitPrice: 12.1666…,    // blended rate: 730 / 60 m²
//   subtotal: 36.50,        // per panel: 730 / 20
//   adjustments: [],
//   adjusted: 36.50,
//   quantity: 20,
//   total: 730.00,          // 10 × 15 + 40 × 12 + 10 × 10
//   appliedTiers: [
//     { upTo: 10, unitPrice: 15, measure: 10, amount: 150 },
//     { upTo: 50, unitPrice: 12, measure: 40, amount: 480 },
//     { unitPrice: 10, measure: 10, amount: 100 }
//   ]
// }
```

### Modes

| `mode`      | How the basis is priced                               | 60 m² on the table above              |
| ----------- | ----------------------------------------------------- | ------------------------------------- |
| `volume`    | The whole basis at the rate of the band it falls into | 60 × 10 = **600**                     |
| `graduated` | Each portion in its own band, like tax brackets       | 10 × 15 + 40 × 12 + 10 × 10 = **730** |

### Basis

| `basis`             | Bands are measured against            | Typical use                                                  |
| ------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `measure` (default) | a single item's measure               | per-item handling: _"a panel up to 2 m² costs 15 €/m²"_      |
| `total`             | the whole line (`measure × quantity`) | quantity breaks: _"the first 10 m² of the order at 15 €/m²"_ |

The `piece` and `flat` strategies always have a measure of `1`, so a tier table
only makes sense for them with `basis: 'total'` — the basis is then the quantity:

```typescript
const engine = new PricingEngine({
  rules: [
    {
      name: 'label',
      type: 'piece',
      unit: 'piece',
      tiers: {
        mode: 'volume',
        basis: 'total',
        bands: [{ upTo: 99, unitPrice: 0.5 }, { unitPrice: 0.35 }],
      },
    },
  ],
});

engine.calculate({ rule: 'label', dimensions: {}, quantity: 50 }).total; // 25 — 50 × 0.50
engine.calculate({ rule: 'label', dimensions: {}, quantity: 250 }).total; // 87.5 — 250 × 0.35
```

- `upTo` is **inclusive**: a band covers `(previous upTo, upTo]`, so with `upTo: 10` a basis of exactly 10 is still in the first band
- Bands must be listed in strictly ascending `upTo` order — they are validated, never sorted
- The last band must omit `upTo` (open-ended), so every basis value is covered by construction
- A rule has either `unitPrice` or `tiers`, never both
- Band rates may rise as well as fall — surcharges for large jobs are allowed
- `minCharge` and adjustments apply after tiering, exactly as for flat rules; `minCharge` stays a per-item floor
- `unitPrice` in the result is the **effective** rate: the band rate for `volume`, the blended rate (tiered amount / basis) for `graduated`
- `appliedTiers` is present only for tiered rules; its entries are in basis units — per item for `measure`, per order line for `total`
- Results are not rounded — rounding to a currency is up to the caller
- Tier tables work inside price lists, so a new price list version can change a tier table just like a flat price

See [ADR 0003](docs/adr/0003-tiered-pricing.md) for the full rationale.

## Use Cases

The engine works for any business where price depends on item dimensions:

- Metal coating & powder painting (price per m²)
- CNC machining, laser cutting (price per area)
- Glass, flooring, fabric (price per m² with minimum charge)
- Printing, labels, packaging (cheaper per piece in bulk — tiered rates)
- Any workflow that schedules price changes ahead or re-quotes past orders
  ("what would this order have cost last year")

Future versions will add a REST API, an interactive playground and custom formulas — see [Roadmap](#roadmap).

## Roadmap

| Version  | Scope                                                       | Status   |
| -------- | ----------------------------------------------------------- | -------- |
| **v0.1** | Area-based pricing, JSON config, minimum charge             | Released |
| **v0.2** | Discounts & surcharges (%, absolute)                        | Released |
| **v0.3** | Calculation strategies (area, linear, volume, weight, etc.) | Released |
| **v0.4** | Price list versioning, effective dates                      | Released |
| **v0.5** | Tiered pricing (volume & graduated)                         | Released |
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

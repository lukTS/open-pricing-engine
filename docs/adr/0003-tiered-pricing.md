# ADR 0003: Tiered pricing (volume & graduated)

- **Status:** Proposed
- **Date:** 2026-09-25
- **Deciders:** Core maintainers

## Context

Until v0.4 every rule had exactly one rate: `subtotal = measure × unitPrice`.
The rate never depended on **how much** was being priced. Real pricing domains
almost always have quantity breaks: _"the first 10 m² of an order cost 15 €/m²,
everything above costs 12"_, _"100 labels are cheaper per piece than 10"_, or
_"a large panel is cheaper per m² to handle than a small one"_.

The industry has two well-known ways of reading such a table:

- **volume** — the whole quantity is charged at the rate of the band it falls
  into (one rate for everything);
- **graduated** — each portion is charged in its own band, like tax brackets.

There is also a second, independent question that is easy to answer silently
and wrongly: **what quantity are the bands measured against** — a single item's
measure, or the whole order line (`measure × quantity`)?

The change must be **additive and non-breaking**: every rule from v0.1–v0.4
has to keep working unchanged, and existing `CalculationResult` objects, error
messages and the calculation pipeline must not move (existing tests assert them
verbatim).

## Decision

A rule may carry a **tier table** instead of a flat `unitPrice`. The tier table
has an explicit `mode` (`volume` | `graduated`), an explicit `basis`
(`measure` | `total`) and a list of `bands`. Tiering replaces the single
multiplication `measure × unitPrice` and nothing else in `calculate()`.

### 1. Data model

```ts
/** One bracket of a tier table. */
type TierBand = {
  upTo?: number; // inclusive upper bound; omitted on the last (open-ended) band
  unitPrice: number; // rate charged for the portion of the basis inside this band
};

type PricingTiers = {
  mode: 'volume' | 'graduated';
  basis?: 'measure' | 'total'; // default: 'measure'
  bands: TierBand[];
};

type PricingRuleConfig = {
  name: string;
  type: string;
  unit: string;
  unitPrice?: number; // exactly one of unitPrice / tiers
  tiers?: PricingTiers;
  minCharge?: number;
  adjustments?: Adjustment[];
};
```

`TierBand`, `PricingTiers` and `AppliedTier` (§5) are exported through
`index.ts` (via the existing `export * from './types.js'`).

- **`unitPrice` and `tiers` are mutually exclusive — exactly one must be
  present.** A rule has exactly one pricing scheme; a dead `unitPrice` next to a
  tier table would be data that lies. Enforced with `superRefine` on the rule
  schema — the same technique already used for `rules` / `priceLists` in v0.4,
  so the codebase has one consistent way of expressing "either/or".
- **`tiers` is a nested object** rather than flat `tierMode` + `tiers[]` fields
  on the rule: `mode`, `basis` and `bands` are meaningless apart from each
  other. Nesting couples them structurally, so "all three or none" needs no
  cross-field validation.

### 2. Tier basis — what the bands are measured against

```
measure = strategy(dimensions)          // per item, unchanged
B       = basis === 'total' ? measure * quantity : measure
```

- **`'measure'` (default)** — bands apply to a single item's measure.
  Use case: _"a panel up to 2 m² costs 15 €/m², a larger one 12 €/m²"_
  (handling cost per item). Fully additive: no division anywhere, existing
  arithmetic untouched.
- **`'total'`** — bands apply to the whole line (`measure × quantity`).
  Use case: the classic quantity break — _"the first 10 m² of the order at
  15 €/m², the rest at 12"_, or _"100 pieces are cheaper per piece"_. This is
  the only meaningful basis for the `piece` / `flat` strategies, whose measure
  is always `1` (there `B` equals `quantity`).

Both bases exist in the wild and mean genuinely different things, so the engine
makes the choice **explicit** instead of silently picking one. The default is
`'measure'` because it is arithmetically exact and structurally neutral;
`'total'` is opt-in.

### 3. Band semantics & the two modes

- `upTo` is an **inclusive** upper bound. Band `i` covers
  `(bands[i-1].upTo, bands[i].upTo]`; the first band covers
  `(0, bands[0].upTo]`. So _"the first 10 m² at 15"_ means `B = 10` is still
  entirely in band 1.
- The **last band must be open-ended** (`upTo` omitted), so every possible basis
  value is covered by construction and there is **no runtime "basis exceeds the
  tier table" error**. This deliberately contrasts with v0.4 price lists, where
  gaps are allowed and produce a runtime error: a date gap can be an intentional
  "not for sale" period, whereas a gap in a price table is always a config bug.
- **volume mode** — the first band whose `upTo >= B` (or the open-ended band)
  supplies a single rate for the whole basis:

  ```
  A = B × rate
  ```

- **graduated mode** — each band prices its own slice (with `upTo_0 = 0`):

  ```
  portion_i = max(min(B, upTo_i) − upTo_{i−1}, 0)
  A         = Σ portion_i × unitPrice_i
  ```

- Band rates need **not** be monotonically decreasing. Ascending tiers
  (surcharges for large jobs) are legal and intentionally unvalidated — the
  engine is a mechanism, not a discount policy.

### 4. Where tiering plugs into the pipeline

The single multiplication `subtotal = measure × unitPrice` becomes a tier
function. **Nothing else in `calculate()` moves**: `minCharge` → adjustments →
`total = adjusted × quantity` stay exactly as they are, and `minCharge` remains
a **per-item** floor.

```
effectiveUnitPrice = mode === 'volume' ? bandRate : A / B
subtotal           = mode === 'volume' ? measure * bandRate
                                       : basis === 'total' ? A / quantity : A
```

The per-item `subtotal` is the tiered amount scaled back to one item. Each
branch avoids a division it does not need: for `volume` the rate is constant
across the basis, so multiplying is both simpler and floating-point exact; for
`graduated` on the `measure` basis, `A` _is_ the per-item amount. Only
`graduated` + `basis: 'total'` needs one real division.

- `CalculationResult.unitPrice` reports the **effective** rate: the band rate
  for `volume`, the blended rate `A / B` for `graduated`, and `rule.unitPrice`
  for untiered rules (unchanged).
- Floating-point: results stay unrounded, exactly as today (percentage
  adjustments already produce FP noise). Rounding is the caller's job (§8).

### 5. Result shape — one optional, additive field

```ts
type AppliedTier = {
  /** Upper bound of the band as configured; omitted for the open-ended top band */
  upTo?: number;
  /** Rate charged for this band's portion */
  unitPrice: number;
  /** Portion of the tier basis charged at this rate */
  measure: number;
  /** measure × unitPrice */
  amount: number;
};

type CalculationResult = {
  /* ...unchanged... */
  /** Tier breakdown; present only when the rule is tiered */
  appliedTiers?: AppliedTier[];
};
```

- **volume** — exactly one entry: `{ upTo?, unitPrice: bandRate, measure: B, amount: A }`.
- **graduated** — one entry per band that actually received a portion; untouched
  upper bands are omitted. Invariant: `Σ amount === A`.
- Entries are expressed in **basis** units: per item for `basis: 'measure'`, per
  whole line for `basis: 'total'`. They explain how the rate was derived, not
  how money is split per item.
- **Why add a field at all**, when ADR 0002 deliberately refused to add
  `appliedVersion`? Because a graduated price is genuinely **not derivable**
  from the other result fields — without the breakdown the engine cannot explain
  its own number. "Explainable price" is exactly the precedent set by
  `AppliedAdjustment` in v0.2. (`appliedVersion`, by contrast, is derivable from
  the `date` the caller already passed.)
- **Why optional instead of always `[]`**: keeping the key absent for untiered
  rules leaves every existing result byte-identical, so all v0.1–v0.4 `toEqual`
  assertions and the README examples keep passing unmodified. It is built with a
  conditional spread — `...(applied ? { appliedTiers: applied } : {})` — so the
  key is truly absent, not `undefined`.

### 6. Construction-time validation (all with descriptive errors)

**Rule level** (inside `PricingRuleConfigSchema.superRefine`, where the rule
name is available):

- both `unitPrice` and `tiers` →
  `Rule "<name>": provide either "unitPrice" or "tiers", not both`
- neither → `Rule "<name>": must contain "unitPrice" or "tiers"`

**Band level** (on the bands array; the Zod `path` points at the offending band
index):

- `bands` non-empty → `At least one tier band is required`
- each `unitPrice` positive → `unitPrice must be positive`
- each `upTo` positive → `Tier band "upTo" must be positive`
- strictly ascending bounds → `Tier bands must be ordered by ascending "upTo"`
- a non-last band without `upTo` → `Only the last tier band may omit "upTo"`
- the last band having `upTo` → `The last tier band must omit "upTo" (open-ended)`

Duplicate `upTo` values are rejected by the strictly-ascending check, so they
need no separate rule.

**Ordering is required, not repaired.** v0.4 sorts `priceLists` by
`effectiveFrom`; tier bands are deliberately **not** sorted. A price list array
is a set of independent windows whose order carries no meaning to a reader,
whereas a tier table is read top-to-bottom like a bracket table — an
out-of-order band is a typo, and silently reordering it would hide the bug.

### 7. Backward compatibility (guaranteed)

- Any rule with `unitPrice` from v0.1–v0.4 works **unchanged**; `tiers` is
  opt-in.
- `CalculationResult` gains no key for untiered rules → existing `toEqual`
  assertions untouched.
- No error message changes, no pipeline reordering; `minCharge` and adjustments
  keep their meaning.
- Tiering lives **inside** a rule, so price list versioning (ADR 0002) and every
  strategy (ADR 0001) work with it for free — a versioned price list can change
  a tier table exactly like a flat price.
- Type-level caveat: `PricingRuleConfig.unitPrice` becomes **optional**, so
  TypeScript consumers that read `rule.unitPrice` as a `number` see it widen to
  `number | undefined`. Runtime behaviour of existing configs is unchanged.
- SemVer: **0.5.0 is a minor, additive release.**

### 8. Non-goals for v0.5

- **Rounding / currency handling.** The engine returns unrounded floats, as it
  always has.
- **Per-band flat fees** (Stripe's `flat_amount`). Additive later if a real need
  appears.
- **Cross-rule order aggregation.** `calculate()` prices one line item; the
  `total` basis stays within a single call. Aggregating an entire basket is the
  host system's job.
- **Discount policy validation** (e.g. forcing rates to decrease) — mechanism,
  not policy.

### 9. Implementation notes

- Tier math lives in a **new internal module `packages/core/src/tiers.ts`**,
  exporting a pure `priceByTiers(basisValue, tiers) → { amount, unitPrice, appliedTiers }`.
  `engine.ts` stays a pipeline orchestrator. The module is **not** re-exported
  from `index.ts` (internal, like `NormalizedPriceList`).
- The engine validates with `.parse()` but reads the **raw** config object, so a
  Zod `.default()` would not reach it: the basis default is applied in code as
  `tiers.basis ?? 'measure'` and the schema field stays `.optional()`.
- `PricingRuleConfigSchema` gains a `.superRefine(...)`; it must still compose
  where it is used today — inside `z.array(...)` in both the legacy `rules`
  branch and `PriceListSchema`.

### Alternatives considered

- **Fixed per-item basis only.** Simplest, but makes the most common real-world
  case — quantity breaks across an order — impossible.
- **Fixed order-total basis only.** Domain-realistic, but silently redefines the
  per-item `subtotal` for every tiered rule and makes per-item handling tiers
  impossible.
- **Always-present `appliedTiers: []`.** Uniform shape, but would have rewritten
  every existing expected result and broken the back-compat guarantee.
- **Sorting bands automatically** (as v0.4 does for price lists). Rejected: it
  would hide typos in a table that humans read top-to-bottom (§6).

## Consequences

**Positive**

- The engine gains volume and graduated quantity breaks with a single new
  concept (`tiers`) and one replaced multiplication — the rest of the pipeline
  is untouched.
- The tier basis is explicit, so the two genuinely different meanings of "tier
  by quantity" cannot be confused by accident.
- Every tier table covers all basis values by construction (mandatory
  open-ended last band), so there is no new runtime error.
- Tiered prices are explainable through `appliedTiers`, while untiered results
  stay byte-identical — v0.5.0 is a clean, additive minor.
- Tiering composes with strategies (ADR 0001) and price list versioning
  (ADR 0002) without any special handling.

**Negative / trade-offs**

- `PricingRuleConfig.unitPrice` widens to `number | undefined` at the type
  level; TypeScript consumers reading it directly need a narrowing check.
- `CalculationResult.unitPrice` now means "effective rate", which for
  `graduated` is a blended value rather than a configured one.
- `appliedTiers` entries are in basis units, so for `basis: 'total'` they
  describe the whole line, not a single item — this must be documented clearly.
- Results stay unrounded; blended rates such as `12.1666…` are exposed as-is and
  rounding remains the caller's responsibility.
- `minCharge` stays a per-item floor even with `basis: 'total'`; an order-level
  minimum is out of scope.

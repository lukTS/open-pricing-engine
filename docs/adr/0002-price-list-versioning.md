# ADR 0002: Price list versioning and effective dates

- **Status:** Accepted
- **Date:** 2026-07-27
- **Deciders:** Core maintainers

## Context

Until v0.3 a `PricingEngine` was configured with a single, timeless set of
`rules`. A rule's price was whatever the config said, forever. Real pricing
domains change over time: the price of a coating is one value in 2025 and
another in 2026, and the business still needs to answer both questions —
"what does this cost today" and "what did this cost on 2026-01-15" (historical
quoting).

We need a way to attach a **validity window** to a set of rules and let
`calculate()` pick the set that was effective on a given date. This must be
**additive and non-breaking**: every `{ rules }` config from v0.1–v0.3 has to
keep working unchanged, and the public result shape and error messages must not
move (existing tests assert them verbatim).

## Decision

Introduce **price list versions**. Each version is a set of rules with an
effective date range; `calculate()` resolves the single version effective on the
target date and runs the existing pipeline against its rules.

### 1. Data model

```ts
type PriceList = {
  version: string; // human-readable label, e.g. "2026-Q1". Debugging/readability ONLY
  effectiveFrom: string; // ISO date-only "YYYY-MM-DD", inclusive
  effectiveTo?: string; // ISO date-only "YYYY-MM-DD", exclusive; omitted = open-ended
  rules: PricingRuleConfig[];
};

type PricingEngineConfig =
  | { rules: PricingRuleConfig[] } // legacy (v0.1–v0.3)
  | { priceLists: PriceList[] }; // versioned (v0.4)
```

`PriceList` and the widened `PricingEngineConfig` union are exported through
`index.ts`. The `version` label is for human readability / debugging **only** —
resolution is purely date-based, never by matching the `version` string.

### 2. Dates — calendar dates in UTC, no time

- `effectiveFrom` / `effectiveTo` are strictly `YYYY-MM-DD` (ISO date-only),
  **not** datetime. Price lists change on calendar dates, not clock times —
  simpler and unambiguous.
- Interpreted as **UTC midnight**: `"2026-01-15"` = `2026-01-15T00:00:00.000Z`.
- The window is `[effectiveFrom, effectiveTo)` — **`effectiveFrom` inclusive,
  `effectiveTo` exclusive**.
- An omitted `effectiveTo` means open-ended to the right (`+Infinity`).
- Boundary format is validated with `z.iso.date()` (Zod v4; datetime is rejected
  on purpose).
- `CalculationInput` gains `date?: Date | string`, default `new Date()`,
  validated with `z.coerce.date()` (accepts a `Date` or an ISO string, yields a
  `Date`). A date-only string parses as UTC midnight — consistent with the
  boundary semantics above.
- Comparison is done on numeric ms:
  `from = Date.parse(effectiveFrom)`,
  `to = effectiveTo ? Date.parse(effectiveTo) : +Infinity`,
  a list matches when `from <= date.getTime() < to`.
- **Why UTC:** local time would make the "end of day" boundary drift with the
  server timezone → production bugs. UTC removes the ambiguity entirely.

### 3. Internal representation & date resolution

The constructor normalizes **any** config into one internal shape, so
`calculate()` is identical for legacy and versioned configs:

```ts
// internal, not exported
type NormalizedPriceList = {
  version: string;
  from: number;
  to: number;
  rules: PricingRuleConfig[];
};
```

- Legacy `{ rules }` → a single
  `{ version: 'default', from: -Infinity, to: +Infinity, rules }`
  (always effective → matches any date).
- Versioned → each version mapped to `{ version, from, to, rules }`; the array is
  **sorted by `from`** (input may be in any order).

`calculate()` (the pipeline after resolution is unchanged):

1. Validate input (`CalculationInputSchema`); `date` defaults to `new Date()`.
2. Find the single `NormalizedPriceList` where `from <= date < to`.
3. Find the rule by name **within that list's rules**.
4. Run the existing pipeline: strategy → minCharge → adjustments → quantity —
   **unchanged**.

### 4. Construction-time validation (all with descriptive errors)

**Config branch** — one object schema plus `superRefine` (NOT a bare `z.union`,
whose messages are ugly):

- both `rules` and `priceLists` present →
  `Provide either "rules" or "priceLists", not both`
- neither present → `Config must contain "rules" or "priceLists"`

**Within one `PriceList`:**

- `rules` non-empty (`.min(1)`) — reuse the existing rule.
- Rule-name uniqueness is **per-price-list, NOT global**. The same rule name
  across versions (same rule, new price) is the whole point of versioning. Reuse
  the current uniqueness `refine` but scope it to each list's `rules`.
- if both bounds present → strictly `effectiveFrom < effectiveTo`
  (equal = empty window = error).

**Across `PriceList`s:**

- `priceLists` non-empty (`.min(1)`).
- `version` values are **unique** (duplicate labels confuse debugging) →
  descriptive error naming the duplicate.
- **No overlapping windows.** After sorting by `from`, each neighbour must
  satisfy `next.from >= prev.to`. Otherwise →
  `Price lists "A" and "B" have overlapping effective windows`.
  - Adjacent windows (`prev.to == next.from`) are **allowed** (seamless join,
    `to` is exclusive).
  - Gaps are **allowed** on purpose: a date in a gap → "no price list effective"
    error (see §5).
  - Two open-ended lists overlap at `+Infinity` → caught by the same overlap
    rule, no special case.

### 5. Runtime error messages (minimal surface → pristine back-compat)

- **New** error (no list effective on the date):
  `No price list is effective on 2026-01-15` (the normalized ISO date).
- **Unknown rule stays unchanged:** `Unknown rule: "<name>"`.
  - Deliberately no version/date context is added: the existing `engine.test.ts`
    asserts this exact text; changing it would break "legacy tests pass
    unmodified". The DX gain is tiny; back-compat purity wins.

### 6. `CalculationResult` shape — NOT changed

`CalculationResult` stays byte-for-byte identical. We do **not** add
`appliedVersion` in v0.4. Rationale (deliberate YAGNI, matching the project's
stance): adding a field would break existing `toEqual` result-shape assertions
and the README example → contradicts "legacy passes unchanged". The caller
already passes `date`, so it knows the version context. It can be added later as
an additive minor if a real need appears.

### 7. Backward compatibility (guaranteed)

- Any `{ rules }` config from v0.1–v0.3 works **unchanged**.
- `date` is optional and irrelevant for legacy (single always-effective list).
- Mixing `rules` + `priceLists` → explicit error (§4).
- Result shape, the `Unknown rule` message, and the whole calculation pipeline
  are unchanged.
- SemVer: **0.4.0 is a minor, additive, non-breaking release.**

This is additive on top of the Strategy pattern (v0.3, ADR 0001) — no changes to
the strategies themselves. Versioning decides _which_ rule set is active; the
strategies still decide _how_ a rule is calculated.

## Consequences

**Positive**

- The engine gains time-aware pricing and historical quoting with a single new
  concept (`PriceList`) and no change to the calculation pipeline.
- Legacy configs are normalized into one always-effective list, so `calculate()`
  has exactly one code path for both legacy and versioned configs — no branching
  on config shape at call time.
- All invariants (no overlap, unique versions, per-list unique rule names, valid
  ranges) are enforced once, at construction time, with descriptive errors —
  runtime resolution stays a simple window lookup.
- The public surface barely moves: one new optional input field (`date`), one
  new runtime error, and no change to `CalculationResult` or existing messages,
  so v0.4.0 is a clean, additive minor.

**Negative / trade-offs**

- Exactly one price list may be effective at any moment (enforced by the
  no-overlap rule). This intentionally rules out **simultaneous** price sets such
  as customer/segment-based pricing (VIP vs. standard) — those are two orthogonal
  axes. The supported answer today is one `PricingEngine` instance per segment,
  each with its own date-versioned `priceLists`. A "named catalogs" feature is
  not planned (see Roadmap / issues-v0.4.0 non-goals).
- Callers who need to know _which_ version was applied must derive it from the
  `date` they passed, because `CalculationResult` deliberately omits
  `appliedVersion` for back-compat. This can be revisited additively if needed.
- Gaps between windows are allowed, so a misconfigured set of dates can leave a
  date uncovered; this surfaces only at runtime as
  `No price list is effective on <date>` rather than at construction time. This
  is a deliberate choice — gaps are a legitimate configuration.

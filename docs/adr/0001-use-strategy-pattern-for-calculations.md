# ADR 0001: Use the Strategy pattern for calculation types

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Core maintainers

## Context

The engine started with a single way to turn dimensions into a billable
`measure`: area (`width × height`). Real pricing domains need more than that —
length (linear profiles), volume, weight, time, per-piece and flat fees.

Adding each new calculation inline (for example a growing `switch (rule.type)`
inside the engine) would concentrate every formula in one place. That approach
has two problems for this project:

- The engine would have to change every time a new calculation type is added,
  which conflicts with keeping it small and stable.
- Each calculation also has its own **required dimensions** (volume needs
  `depth`, weight needs `weight`, `flat` needs nothing). A central switch would
  mix the "how to compute" logic with the "what is required" validation.

## Decision

Model each calculation type as a **strategy**: a small object that knows how to
compute its own `measure` and which dimensions it requires.

```ts
export interface CalculationStrategy {
  measure: (dimensions: CalculationDimensions) => number;
  requiredFields: readonly DimensionField[];
}
```

Strategies are collected in a registry keyed by rule `type`:

```ts
export const strategies: Record<string, CalculationStrategy> = {
  area,
  linear,
  volume,
  weight,
  time,
  piece,
  flat,
};
```

Two things are then derived from that single registry, so there is no manual
list to keep in sync:

- **`RuleTypeSchema`** — the set of valid rule types (`z.enum` over the registry
  keys), which rejects unknown types at config time.
- **`dimensionSchemasByType`** — a per-strategy Zod schema built from each
  strategy's `requiredFields`, which validates dimensions before calculation.

The engine stays generic: it looks up the strategy, validates dimensions with
the matching schema, then calls `strategy.measure(...)`.

## Consequences

**Positive**

- Adding a new calculation type is a self-contained change: create one strategy
  file and register it — the engine, type validation and dimension validation
  all follow automatically from the registry.
- Computation and per-type validation live next to each other, one strategy at a
  time, which keeps each unit small and easy to test in isolation.
- The engine has no knowledge of individual formulas, so it rarely changes.

**Negative / trade-offs**

- The registry is an internal, code-level extension point: today you cannot
  register a custom strategy from outside the package without editing it. A
  public plugin API for user-defined formulas is deliberately deferred to the
  v1.0 roadmap item and will be tracked as its own decision when we get there.
- A tiny amount of defensive code in `measure()` (the `?? 0` fallbacks) is
  unreachable because validation runs first; it exists only to satisfy the
  optional dimension types and is annotated as ignored for coverage.

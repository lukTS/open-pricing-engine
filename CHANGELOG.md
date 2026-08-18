# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-08-18

### Added

- Price list versioning: an engine config can now provide `priceLists` instead of
  a flat `rules` array. Each price list holds its own rules and an effective date
  range — `effectiveFrom` (inclusive) and optional `effectiveTo` (exclusive), ISO
  `YYYY-MM-DD` dates read as UTC midnight. Omitting `effectiveTo` leaves the list
  open-ended.
- `CalculationInput.date` — optional `Date` or ISO string, defaulting to the
  current date, that selects the effective price list. This enables historical
  quoting ("what would this order have cost last year").
- Construction-time validation for versioned configs, each with a descriptive
  error: exactly one of `rules` / `priceLists`, non-overlapping effective windows
  (adjacent windows are allowed), unique `version` labels, `effectiveFrom` before
  `effectiveTo`, and rule names unique **per price list**.
- New runtime error when no price list covers the requested date:
  `No price list is effective on <ISO date>`.
- Architecture Decision Record documenting price list versioning
  (`docs/adr/0002-price-list-versioning.md`).

### Changed

- A legacy `{ rules }` config is normalized internally into a single,
  always-effective price list, so `calculate()` has one code path for both config
  shapes. Existing configs, the `CalculationResult` shape and all existing error
  messages are unchanged — 0.4.0 is additive and backward compatible.

## [0.3.0] - 2026-07-19

### Added

- Calculation strategies selectable via the rule `type` field. Alongside the
  existing `area` (`width × height`), the engine now supports:
  - `linear` — `length`
  - `volume` — `width × height × depth`
  - `weight` — `weight`
  - `time` — `hours`
  - `piece` and `flat` — a fixed measure of `1` (per-unit item / fixed fee).
- Per-strategy dimension validation: each strategy declares its required
  dimensions, validated with descriptive Zod errors before calculation.
- Rule `type` is validated against the known strategy registry at config time,
  so an unknown type is rejected when the engine is constructed.
- Architecture Decision Record documenting the Strategy pattern
  (`docs/adr/0001-use-strategy-pattern-for-calculations.md`).

## [0.2.0] - 2026-06-12

### Added

- Price adjustments: discounts and surcharges applied to the subtotal.
  - `percentage` adjustments (relative, validated to the -100..100 range).
  - `fixed` adjustments (absolute amount).
  - Adjustments are applied sequentially in array order (cascade), each one
    calculated from the current adjusted value.
- `CalculationResult` now exposes:
  - `adjustments` — the breakdown of every applied adjustment with its calculated `amount`.
  - `adjusted` — the subtotal after all adjustments.
- Zod validation for adjustments: non-empty name, valid type, percentage range,
  and unique adjustment names within a rule.

### Changed

- `total` is now calculated as `adjusted * quantity` (previously `subtotal * quantity`).
  When no adjustments are configured, `adjusted` equals `subtotal`, so the result is
  unchanged for existing configurations.

## [0.1.0] - 2026-05-22

### Added

- Initial release of the pricing engine.
- Area-based pricing: `subtotal = width * height * unitPrice`.
- Optional `minCharge` per rule.
- `total = subtotal * quantity`.
- Zod validation for engine configuration and calculation input.
- 100% test coverage.

[0.4.0]: https://github.com/lukTS/open-pricing-engine/releases/tag/v0.4.0
[0.3.0]: https://github.com/lukTS/open-pricing-engine/releases/tag/v0.3.0
[0.2.0]: https://github.com/lukTS/open-pricing-engine/releases/tag/v0.2.0
[0.1.0]: https://github.com/lukTS/open-pricing-engine/releases/tag/v0.1.0

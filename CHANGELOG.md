# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/lukTS/open-pricing-engine/releases/tag/v0.2.0
[0.1.0]: https://github.com/lukTS/open-pricing-engine/releases/tag/v0.1.0

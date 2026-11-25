/**
 * Stable, machine-readable code of a {@link PricingError}.
 *
 * - `UNKNOWN_RULE` — `input.rule` does not match any rule of the effective price list.
 * - `NO_EFFECTIVE_PRICE_LIST` — no price list is effective on the requested date
 *   (or on today, when `input.date` is omitted).
 *
 * Codes are a contract: they never change once released. Messages are for humans and may be
 * reworded, so branch on `code`, never on `message`.
 */
export type PricingErrorCode = 'UNKNOWN_RULE' | 'NO_EFFECTIVE_PRICE_LIST';

/**
 * Thrown by `PricingEngine.calculate()` when a well-formed input cannot be priced because of
 * the caller: the requested rule does not exist, or no price list covers the date.
 *
 * Invalid input shape still throws a `ZodError`; any other `Error` means a bug in the engine.
 *
 * @example
 * try {
 *   engine.calculate(input);
 * } catch (error) {
 *   if (error instanceof PricingError && error.code === 'UNKNOWN_RULE') {
 *     // ask the user to pick another rule
 *   }
 *   throw error;
 * }
 */
export class PricingError extends Error {
  /** Machine-readable reason; see {@link PricingErrorCode}. */
  readonly code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
  }
}

// Typed errors for invalid input or configuration in the domain engine.
// Expected business outcomes (stock short, offer changed) are returned as
// results, not thrown; see the stock module.

export type DomainErrorCode =
  | "INVALID_VALUE"
  | "INVALID_QUANTITY"
  | "INVALID_SCHEME"
  | "EMPTY_ORDER"
  | "TOO_MANY_LINES"
  | "DUPLICATE_SKU"
  | "SKU_INACTIVE"
  | "ORDER_TOO_LARGE"
  | "INVALID_TRANSITION"
  | "REASON_REQUIRED";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

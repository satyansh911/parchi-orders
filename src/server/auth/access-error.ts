// Expected access outcomes, thrown by the data-access layer and turned into
// results by the action wrapper (or into 404 / login redirects by pages).
// NOT_ALLOWED: the record is yours, but its status doesn't allow this (D30).

export type AccessErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "RETAILER_REQUIRED" | "NOT_ALLOWED";

export class AccessError extends Error {
  constructor(readonly code: AccessErrorCode) {
    super(code);
    this.name = "AccessError";
  }
}

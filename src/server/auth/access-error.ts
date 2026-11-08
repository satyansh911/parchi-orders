// Expected access outcomes, thrown by the data-access layer and turned into
// results by the action wrapper (or into 404 / login redirects by pages).

export type AccessErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "RETAILER_REQUIRED";

export class AccessError extends Error {
  constructor(readonly code: AccessErrorCode) {
    super(code);
    this.name = "AccessError";
  }
}

// Safety guard for integration tests (D49). Integration tests reset tables, so
// they must never run against the primary database or any protected database.
// Pure functions: no I/O here, so the guard itself is unit-tested.

export const TEST_MARKER_TABLE = "_parchi_test_marker";

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(`Refusing to use this database for integration tests: ${message}`);
    this.name = "UnsafeTestDatabaseError";
  }
}

/**
 * A stable identity for a database endpoint, independent of credentials,
 * query parameters, letter case and Neon's pooled vs direct host names.
 * Every Neon branch has its own endpoint ID (ep-…), so two URLs with the same
 * identity reach the same data.
 */
export function databaseIdentity(urlOrHost: string): string {
  const host = parseHost(urlOrHost);
  if (host.hostname.endsWith(".neon.tech")) {
    const endpoint = host.hostname.split(".")[0].replace(/-pooler$/, "");
    return `neon:${endpoint}`;
  }
  return `pg:${host.hostname}:${host.port || "5432"}`;
}

export type GuardInput = {
  testUrl: string | undefined;
  /** URLs that must never be used, e.g. DATABASE_URL and DIRECT_URL. */
  protectedUrls: Array<string | undefined>;
  /** Extra protected host names, e.g. the old US database (PROTECTED_DATABASE_HOSTS). */
  protectedHosts: string[];
};

/** Throws UnsafeTestDatabaseError unless `testUrl` is clearly a separate database. */
export function assertSafeTestDatabase({ testUrl, protectedUrls, protectedHosts }: GuardInput): URL {
  if (!testUrl) {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL is not set.");
  }

  let url: URL;
  try {
    url = new URL(testUrl);
  } catch {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL is not a valid URL.");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL must be a postgresql:// URL.");
  }
  if (url.searchParams.get("sslmode") !== "verify-full" && !isLocalHost(url.hostname)) {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL must use sslmode=verify-full (D39).");
  }

  const testIdentity = databaseIdentity(testUrl);
  const protectedIdentities = [
    ...protectedUrls.filter((u): u is string => Boolean(u)),
    ...protectedHosts,
  ].map(databaseIdentity);

  if (protectedIdentities.length === 0) {
    throw new UnsafeTestDatabaseError(
      "no protected databases are configured (set DATABASE_URL), so safety can't be checked.",
    );
  }
  if (protectedIdentities.includes(testIdentity)) {
    throw new UnsafeTestDatabaseError(
      `it points at a protected database (${testIdentity}). Use a separate Neon test branch.`,
    );
  }
  return url;
}

/** Parses "host", "host:port" or a full URL. */
function parseHost(urlOrHost: string): URL {
  const value = urlOrHost.trim().toLowerCase();
  try {
    return new URL(value.includes("://") ? value : `postgresql://${value}`);
  } catch {
    throw new UnsafeTestDatabaseError(`"${urlOrHost}" is not a valid database URL or host.`);
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/** Reads PROTECTED_DATABASE_HOSTS ("host1,host2"). */
export function parseProtectedHosts(value: string | undefined): string[] {
  return (value ?? "").split(",").map((h) => h.trim()).filter(Boolean);
}

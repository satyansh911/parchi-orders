import { describe, expect, it } from "vitest";
import {
  UnsafeTestDatabaseError,
  assertSafeTestDatabase,
  databaseIdentity,
  parseProtectedHosts,
} from "./db-guard";

// Fake hosts and credentials: no real endpoints in tests.
const SSL = "?sslmode=verify-full&channel_binding=require";
const primaryPooled = `postgresql://app:pw@ep-primary-111-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb${SSL}`;
const primaryDirect = `postgresql://app:pw@ep-primary-111.c-2.ap-southeast-1.aws.neon.tech/neondb${SSL}`;
const oldUsHosts = [
  "ep-oldus-222-pooler.c-9.us-east-2.aws.neon.tech",
  "ep-oldus-222.c-9.us-east-2.aws.neon.tech",
];
const testBranch = `postgresql://app:pw@ep-testbranch-333.c-2.ap-southeast-1.aws.neon.tech/neondb${SSL}`;

const guard = (testUrl: string | undefined) =>
  assertSafeTestDatabase({
    testUrl,
    protectedUrls: [primaryPooled, primaryDirect],
    protectedHosts: oldUsHosts,
  });

describe("databaseIdentity", () => {
  it("treats Neon pooled and direct hosts of one endpoint as the same database", () => {
    expect(databaseIdentity(primaryPooled)).toBe("neon:ep-primary-111");
    expect(databaseIdentity(primaryDirect)).toBe("neon:ep-primary-111");
  });

  it("ignores credentials, query parameters and letter case", () => {
    const shouting = primaryDirect.replace("ep-primary-111", "EP-PRIMARY-111").replace(SSL, "");
    expect(databaseIdentity(shouting)).toBe("neon:ep-primary-111");
  });

  it("accepts bare host names", () => {
    expect(databaseIdentity(oldUsHosts[0])).toBe("neon:ep-oldus-222");
  });

  it("uses host and port for non-Neon databases", () => {
    expect(databaseIdentity("postgresql://u:p@localhost/db")).toBe("pg:localhost:5432");
    expect(databaseIdentity("postgresql://u:p@db.internal:6543/db")).toBe("pg:db.internal:6543");
  });
});

describe("assertSafeTestDatabase", () => {
  it("accepts a separate Neon branch", () => {
    expect(guard(testBranch).hostname).toBe("ep-testbranch-333.c-2.ap-southeast-1.aws.neon.tech");
  });

  it("refuses when TEST_DATABASE_URL is missing or empty", () => {
    expect(() => guard(undefined)).toThrow(UnsafeTestDatabaseError);
    expect(() => guard("")).toThrow(/not set/);
  });

  it("refuses the primary database, pooled or direct", () => {
    expect(() => guard(primaryPooled)).toThrow(/protected database/);
    expect(() => guard(primaryDirect)).toThrow(/protected database/);
  });

  it("refuses the primary even with different credentials, params or case", () => {
    const disguised = `postgresql://other:secret@EP-PRIMARY-111.c-2.ap-southeast-1.aws.neon.tech/otherdb${SSL}`;
    expect(() => guard(disguised)).toThrow(/protected database/);
  });

  it("refuses the old US database by protected host, pooled or direct", () => {
    for (const host of oldUsHosts) {
      expect(() => guard(`postgresql://u:p@${host}/neondb${SSL}`)).toThrow(/protected database/);
    }
  });

  it("refuses non-Postgres URLs and invalid URLs", () => {
    expect(() => guard("mysql://u:p@ep-x.neon.tech/db")).toThrow(/postgresql:\/\//);
    expect(() => guard("not a url")).toThrow(/valid URL/);
  });

  it("requires sslmode=verify-full for remote databases (D39)", () => {
    expect(() => guard(testBranch.replace("verify-full", "require"))).toThrow(/verify-full/);
  });

  it("refuses when no protected databases are configured", () => {
    expect(() =>
      assertSafeTestDatabase({ testUrl: testBranch, protectedUrls: [undefined], protectedHosts: [] }),
    ).toThrow(/no protected databases/);
  });
});

describe("parseProtectedHosts", () => {
  it("splits a comma list and drops blanks", () => {
    expect(parseProtectedHosts(" a.neon.tech, ,b.neon.tech ")).toEqual(["a.neon.tech", "b.neon.tech"]);
    expect(parseProtectedHosts(undefined)).toEqual([]);
  });
});

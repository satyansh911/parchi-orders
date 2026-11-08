// D67 enforced structurally: every server action in the codebase must be
// built with the common wrapper. Adding an unguarded action fails this test.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isGuardedAction } from "./action-core";

vi.mock("@/server/db", () => ({ db: {} }));

const SRC = join(process.cwd(), "src");
const USE_SERVER = /(^|\n)\s*["']use server["'];?/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "generated" || name === "node_modules") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));
const actionModules = files.filter((f) => /^\s*(\/\/[^\n]*\n|\s)*["']use server["']/.test(f.text));

describe("every server action is built with the common wrapper (D67)", () => {
  it("finds the action modules", () => {
    expect(actionModules.map((f) => relative(SRC, f.path))).toContain(join("app", "login", "actions.ts"));
  });

  it("has no inline 'use server' functions (they would bypass the wrapper)", () => {
    const inline = files.filter((f) => USE_SERVER.test(f.text) && !actionModules.includes(f)).map((f) => relative(SRC, f.path));
    expect(inline).toEqual([]);
  });

  it.each(actionModules.map((f) => [relative(SRC, f.path), f.path]))("every export of %s is a guarded action", async (_name, path) => {
    const mod: Record<string, unknown> = await import(path);
    const exports = Object.entries(mod);
    expect(exports.length).toBeGreaterThan(0);
    for (const [name, value] of exports) expect(isGuardedAction(value), `${name} is not built with action()`).toBe(true);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest (D86)", () => {
  const m = manifest();

  it("is installable: name, standalone display, start URL and theme", () => {
    expect(m).toMatchObject({ name: "Parchi Orders", short_name: "Parchi", display: "standalone", start_url: "/", scope: "/", theme_color: "#0f766e" });
  });

  it("has 192 and 512 icons plus a maskable icon", () => {
    expect(m.icons?.map((i) => [i.sizes, i.purpose])).toEqual([["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]]);
  });

  it("starts at / so desk users who install it also land on their own home", () => {
    expect(m.start_url).toBe("/");
  });
});

describe("service worker only for the salesman app (D86, superseded for salesmen by D108)", () => {
  it("only the salesman app registers one", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (n === "generated") return [];
        return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
      });
    const offenders = files(join(process.cwd(), "src")).filter((f) => /serviceWorker\s*\.\s*register/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.replace(join(process.cwd(), "src"), "src"))).toEqual(["src/app/salesman/salesman-app.tsx"]);
  });

  it("the worker caches only the salesman shell and static files, never data or other pages", () => {
    const sw = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toMatch(/const SHELL = "\/salesman"/);
    expect(sw).toMatch(/request\.method !== "GET"\) return/);
    expect(sw).not.toMatch(/\/catalogue|\/cart|\/orders|\/desk|\/api\//);
  });
});

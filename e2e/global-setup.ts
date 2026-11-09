import { execFileSync } from "node:child_process";

// Fresh demo data on the TEST BRANCH before every run. The seed script refuses
// anything but a guarded, marked test database (D49, D88).
export default function globalSetup() {
  execFileSync("pnpm", ["-s", "test:e2e:seed"], { stdio: "inherit", env: { ...process.env, NODE_OPTIONS: PREFER_IPV4 } });
}

/**
 * Local network robustness only: Node resolves Neon's IPv6 address first, and
 * a dev machine's rotating temporary IPv6 address can drop mid-run
 * (EADDRNOTAVAIL / EHOSTUNREACH). Preferring IPv4 for the E2E processes avoids
 * that. It changes nothing in the app or in production.
 */
export const PREFER_IPV4 = "--dns-result-order=ipv4first";

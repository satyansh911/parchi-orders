// CSRF protection for state-changing Route Handlers (D69.11). Server Actions
// already get Next.js's own Origin/Host check; route handlers don't, so they
// call this. A state-changing request must carry an Origin header equal to
// this site's origin. The expected host comes from x-forwarded-host only on
// Vercel (D70); elsewhere from Host.

type HeaderGetter = { get(name: string): string | null };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSameOriginRequest(method: string, headers: HeaderGetter, onVercel: boolean): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;

  const origin = headers.get("origin");
  if (!origin || origin === "null") return false;

  const host = (onVercel ? headers.get("x-forwarded-host") : null) ?? headers.get("host");
  if (!host) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  return originHost.toLowerCase() === host.split(",")[0].trim().toLowerCase();
}

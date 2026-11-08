// Where to send a user after login (D68). `next` is honoured only if it is a
// safe relative path inside the user's own area; otherwise the role's home.

import type { Role } from "@/generated/prisma/enums";

const AREAS: Record<Role, readonly string[]> = {
  RETAILER: ["/catalogue", "/cart", "/orders", "/capture"],
  DESK: ["/desk"],
};

export function homeFor(role: Role): string {
  return role === "DESK" ? "/desk" : "/catalogue";
}

export function safeNextPath(next: unknown, role: Role): string {
  const home = homeFor(role);
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return home;
  // Only same-site relative paths: no scheme, no protocol-relative //, no backslash tricks, no control characters.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return home;

  const base = "http://parchi.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return home;
  }
  if (url.origin !== base) return home;

  // After URL normalisation ("/catalogue/../desk" becomes "/desk"), it must be in the user's area.
  const inArea = AREAS[role].some((area) => url.pathname === area || url.pathname.startsWith(`${area}/`));
  return inArea ? `${url.pathname}${url.search}` : home;
}

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/server/auth/cookie-config";

// Optimistic redirect only (D64): no session cookie → login. It never looks
// at the database; every page and action still checks the session itself.

export function proxy(request: NextRequest) {
  if (SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name))) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/catalogue/:path*", "/cart/:path*", "/orders/:path*", "/capture/:path*", "/desk/:path*"],
};

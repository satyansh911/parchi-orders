// Session cookie settings follow the real request protocol (D60, D70).
// x-forwarded-proto is trusted ONLY on Vercel (VERCEL=1), where Vercel's edge
// sets it and a client can't override it. Anywhere else forwarded headers are
// ignored and the request is treated as plain HTTP (local dev and local builds).

export const SECURE_COOKIE_NAME = "__Host-parchi_session";
export const LOCAL_COOKIE_NAME = "parchi_session";
export const SESSION_COOKIE_NAMES = [SECURE_COOKIE_NAME, LOCAL_COOKIE_NAME] as const;

export type ProtocolContext = {
  /** process.env.VERCEL === "1" */
  onVercel: boolean;
  /** Value of the x-forwarded-proto header, if any. */
  forwardedProto: string | null;
};

export function isHttpsRequest({ onVercel, forwardedProto }: ProtocolContext): boolean {
  if (!onVercel) return false;
  // Vercel may append values for chained proxies; its own value comes first.
  return forwardedProto?.split(",")[0]?.trim().toLowerCase() === "https";
}

export type SessionCookieSettings = {
  name: typeof SECURE_COOKIE_NAME | typeof LOCAL_COOKIE_NAME;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
    expires: Date;
  };
};

/** Settings for writing the session cookie. No Domain attribute, ever (required by __Host-). */
export function sessionCookieSettings(ctx: ProtocolContext, expiresAt: Date, now: Date): SessionCookieSettings {
  const https = isHttpsRequest(ctx);
  return {
    name: https ? SECURE_COOKIE_NAME : LOCAL_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: https,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
      expires: expiresAt,
    },
  };
}

/** Name to read on this request: the HTTPS cookie is never read over HTTP and vice versa. */
export function sessionCookieName(ctx: ProtocolContext): SessionCookieSettings["name"] {
  return isHttpsRequest(ctx) ? SECURE_COOKIE_NAME : LOCAL_COOKIE_NAME;
}

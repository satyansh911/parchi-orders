import "server-only";
import { cookies, headers } from "next/headers";
import { sessionCookieName, sessionCookieSettings, type ProtocolContext } from "./cookie-config";

// Next.js glue for the session cookie. Settings follow the real request
// protocol (D70). Writing and deleting only work in Server Actions and
// Route Handlers, which is where login and logout happen.

export async function protocolContext(): Promise<ProtocolContext> {
  const h = await headers();
  return { onVercel: process.env.VERCEL === "1", forwardedProto: h.get("x-forwarded-proto") };
}

export async function readSessionToken(): Promise<string | undefined> {
  const name = sessionCookieName(await protocolContext());
  return (await cookies()).get(name)?.value;
}

export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const { name, options } = sessionCookieSettings(await protocolContext(), expiresAt, new Date());
  (await cookies()).set(name, token, options);
}

export async function clearSessionCookie(): Promise<void> {
  const name = sessionCookieName(await protocolContext());
  (await cookies()).delete(name);
}

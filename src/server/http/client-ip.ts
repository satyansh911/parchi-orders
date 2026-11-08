// Client IP for rate limiting (D56). Like the protocol (D70), forwarded
// headers are trusted ONLY on Vercel, whose edge sets x-real-ip and
// x-forwarded-for itself. Anywhere else they are client-controlled, so all
// requests share one "local" bucket rather than letting a header pick its own.

type HeaderGetter = { get(name: string): string | null };

export function clientIp(headers: HeaderGetter, onVercel: boolean): string {
  if (!onVercel) return "local";
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

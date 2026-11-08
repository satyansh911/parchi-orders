import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { otpProviderFromEnv } from "@/server/auth/otp";
import { homeFor } from "@/server/auth/redirects";
import { getViewer } from "@/server/auth/viewer";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · Parchi Orders" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 pt-10">
      <h1 className="text-xl font-semibold">Parchi Orders</h1>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <Suspense fallback={null}>
        <DemoBanner />
      </Suspense>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

/** Already signed in → straight to the role's home. */
async function RedirectIfSignedIn() {
  const viewer = await getViewer();
  if (viewer) redirect(homeFor(viewer.role));
  return null;
}

/** Shown only when demo OTP is enabled at runtime (D55, D71). */
async function DemoBanner() {
  await connection(); // read the environment at request time, not build time
  const demoCode = otpProviderFromEnv()?.demoCode;
  if (!demoCode) return null;
  return (
    <p role="note" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm">
      Demo mode: no SMS is sent. Use code <strong className="font-mono">{demoCode}</strong>.
    </p>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/auth/action-core";
import { requestOtpAction, verifyOtpAction, type LoginOutcome } from "./actions";
import type { LoginStrings } from "./strings";

// The strings come from the server in the user's language (D72), so no
// dictionary ships in the client bundle.
type Strings = LoginStrings;

type Failure = Extract<ActionResult<LoginOutcome>, { ok: false }>["error"] | Extract<LoginOutcome, { error: string }>["error"];

function failureOf(result: ActionResult<LoginOutcome>): Failure | null {
  if (!result.ok) return result.error;
  return "error" in result.data ? result.data.error : null;
}

const inputClass = "min-h-12 rounded-card border border-line px-3 text-lg";
const primaryButton = "min-h-12 rounded-card bg-accent px-4 text-base font-semibold text-paper disabled:opacity-60";

export function LoginForm({ strings: s }: { strings: Strings }) {
  const next = useSearchParams().get("next") ?? undefined;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const message = (failure: Failure) => s[`login.error.${failure}`];

  function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestOtpAction({ phone });
      const failure = failureOf(result);
      if (failure) return setError(message(failure));
      if (result.ok && "phone" in result.data) setPhone(result.data.phone);
      setStep("code");
      setError(null);
    });
  }

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      // On success the action redirects; it only returns on failure.
      const failure = failureOf(await verifyOtpAction({ phone, code, next }));
      if (failure) setError(message(failure));
    });
  }

  const errorLine = error && <p role="alert" className="text-sm text-danger">{error}</p>;

  return step === "phone" ? (
    <form onSubmit={submitPhone} className="flex flex-col gap-3">
      <label htmlFor="phone" className="text-sm font-medium">{s["login.phoneLabel"]}</label>
      <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      {errorLine}
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? s["login.sending"] : s["login.getCode"]}</button>
    </form>
  ) : (
    <form onSubmit={submitCode} className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{s["login.codeSentTo"].replace("{phone}", phone)}</p>
      <label htmlFor="code" className="text-sm font-medium">{s["login.codeLabel"]}</label>
      <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} className={`${inputClass} tracking-[0.4em]`} />
      {errorLine}
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? s["login.checking"] : s["login.logIn"]}</button>
      <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(null); }} className="min-h-11 text-sm text-accent underline">
        {s["login.changeNumber"]}
      </button>
    </form>
  );
}

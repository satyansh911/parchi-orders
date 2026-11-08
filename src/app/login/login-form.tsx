"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/auth/action-core";
import { requestOtpAction, verifyOtpAction, type LoginOutcome } from "./actions";

// Minimal functional login (D65). Full design, language picker and Hindi
// strings come in Phase 4.

type Failure = Extract<ActionResult<LoginOutcome>, { ok: false }>["error"] | Extract<LoginOutcome, { error: string }>["error"];

const MESSAGES: Record<Failure, string> = {
  LOGIN_DISABLED: "SMS login is not configured.",
  INVALID_PHONE: "Enter a 10-digit mobile number.",
  INVALID_CREDENTIALS: "Wrong number or code. Please try again.",
  INVALID_INPUT: "Something was wrong with the form. Please try again.",
  RATE_LIMITED: "Too many attempts. Please wait 15 minutes and try again.",
  UNAUTHENTICATED: "Please log in again.",
  NOT_FOUND: "Something went wrong. Please try again.",
  RETAILER_REQUIRED: "Something went wrong. Please try again.",
};

/** The failure in a login action result, or null on success. */
function failureOf(result: ActionResult<LoginOutcome>): Failure | null {
  if (!result.ok) return result.error;
  return "error" in result.data ? result.data.error : null;
}

export function LoginForm() {
  const next = useSearchParams().get("next") ?? undefined;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestOtpAction({ phone });
      const failure = failureOf(result);
      if (failure) return setError(MESSAGES[failure]);
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
      if (failure) setError(MESSAGES[failure]);
    });
  }

  return step === "phone" ? (
    <form onSubmit={submitPhone} className="flex flex-col gap-3">
      <label htmlFor="phone" className="text-sm font-medium">Mobile number</label>
      <input
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="min-h-11 rounded border border-neutral-400 px-3 text-base"
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="min-h-11 rounded bg-neutral-900 px-4 font-medium text-white disabled:opacity-60">
        {pending ? "Sending…" : "Get code"}
      </button>
    </form>
  ) : (
    <form onSubmit={submitCode} className="flex flex-col gap-3">
      <p className="text-sm">Code sent to {phone}</p>
      <label htmlFor="code" className="text-sm font-medium">6-digit code</label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="min-h-11 rounded border border-neutral-400 px-3 text-base tracking-widest"
      />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="min-h-11 rounded bg-neutral-900 px-4 font-medium text-white disabled:opacity-60">
        {pending ? "Checking…" : "Log in"}
      </button>
      <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(null); }} className="min-h-11 text-sm underline">
        Change number
      </button>
    </form>
  );
}

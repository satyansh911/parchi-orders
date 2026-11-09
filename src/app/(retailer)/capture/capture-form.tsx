"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { interpretMessageAction } from "@/app/actions/capture";
import { fill } from "@/i18n/fill";
import type { CaptureFormStrings } from "./strings";

const MAX = 1000;

/**
 * Free-text order (D94). One request ID per message: a retry after a lost
 * response reuses it (the server returns the same capture, D96); editing the
 * message starts a new one.
 */
export function CaptureForm({ s }: { s: CaptureFormStrings }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    requestId.current ??= crypto.randomUUID();
    const clientRequestId = requestId.current;
    startTransition(async () => {
      try {
        const result = await interpretMessageAction({ clientRequestId, message });
        if (!result.ok) return setError(result.error === "UNAUTHENTICATED" ? s["capture.error"] : s["capture.error"]);
        if (result.data.outcome === "RATE_LIMITED") return setError(s["capture.rateLimited"]);
        if (result.data.outcome === "REJECTED") {
          requestId.current = null;
          return setError(s["capture.error"]);
        }
        requestId.current = null;
        router.push(`/capture/${result.data.captureId}`);
      } catch {
        setError(s["capture.error"]); // keep the request ID: a retry returns the same capture
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{s["capture.hint"]}</p>
      <label htmlFor="order-message" className="sr-only">{s["capture.label"]}</label>
      <textarea
        id="order-message"
        rows={6}
        maxLength={MAX}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          requestId.current = null; // a different message is a new request
          setError(null);
        }}
        placeholder={s["capture.placeholder"]}
        className="rounded-card border border-line p-3 text-lg leading-relaxed"
      />
      <p className="self-end text-xs text-ink-muted" aria-live="polite">{fill(s["capture.chars"], { n: message.length })}</p>
      {error && <p role="alert" className="rounded-card bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button type="submit" disabled={pending || !message.trim()} className="min-h-14 rounded-card bg-accent px-5 text-lg font-semibold text-paper disabled:bg-paper-dim disabled:text-ink-faint">
        {pending ? s["capture.reading"] : s["capture.submit"]}
      </button>
    </form>
  );
}

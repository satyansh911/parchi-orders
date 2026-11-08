"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/login/actions";

/**
 * Logout is a server action, so it is always a POST, never a GET (D69.7).
 * The action redirects to /login when it finishes.
 */
export function LogoutButton({ label = "Log out", pendingLabel = "Logging out…" }: { label?: string; pendingLabel?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await logoutAction();
        });
      }}
    >
      <button type="submit" disabled={pending} className="min-h-11 rounded-full border border-line px-4 text-sm text-ink-muted disabled:opacity-60">
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/login/actions";

/**
 * Logout is a server action, so it is always a POST, never a GET (D69.7).
 * The action redirects to /login when it finishes.
 */
export function LogoutButton() {
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
      <button type="submit" disabled={pending} className="min-h-11 rounded border border-neutral-400 px-4 text-sm disabled:opacity-60">
        {pending ? "Logging out…" : "Log out"}
      </button>
    </form>
  );
}

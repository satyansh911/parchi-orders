"use client";

import { useEffect, useState } from "react";

// D114: Auto (follow the phone) → Light → Dark. Stored on this device only;
// app/layout.tsx applies it before first paint so there is no flash.
type Mode = "auto" | "light" | "dark";
const KEY = "parchi_theme";
const NEXT: Record<Mode, Mode> = { auto: "light", light: "dark", dark: "auto" };

function apply(mode: Mode) {
  if (mode === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
}

export function ThemeToggle({ labels }: { labels: { auto: string; light: string; dark: string; change: string } }) {
  const [mode, setMode] = useState<Mode>("auto");
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved === "light" || saved === "dark") setMode(saved);
      } catch {
        /* storage blocked: stay on auto */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function cycle() {
    const next = NEXT[mode];
    setMode(next);
    apply(next);
    try {
      if (next === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* keep it for this page only */
    }
  }

  return (
    <button type="button" onClick={cycle} aria-label={`${labels.change}: ${labels[mode]}`} title={labels[mode]}
      className="press grid h-11 w-11 flex-none place-items-center rounded-full border border-line text-ink-muted">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {mode === "light" ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>
        ) : mode === "dark" ? (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        ) : (
          <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" /></>
        )}
      </svg>
    </button>
  );
}

/** Runs before first paint (inline in <head>): applies a saved Light/Dark choice. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

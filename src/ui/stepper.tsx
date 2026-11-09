"use client";

// Case quantity control with 48 px tap targets. Zero shows a single "Add" button.
export function Stepper({
  value,
  onIncrease,
  onDecrease,
  addLabel,
  increaseLabel,
  decreaseLabel,
  quantityLabel,
  disabled = false,
}: {
  value: number;
  onIncrease: () => void;
  onDecrease: () => void;
  addLabel: string;
  increaseLabel: string;
  decreaseLabel: string;
  quantityLabel: string;
  disabled?: boolean;
}) {
  if (value === 0) {
    return (
      <button type="button" disabled={disabled} onClick={onIncrease} className="press inline-flex min-h-12 min-w-24 items-center justify-center gap-1.5 rounded-full bg-accent px-5 text-base font-semibold text-paper active:bg-accent-strong disabled:bg-paper-dim disabled:text-ink-faint">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        {addLabel}
      </button>
    );
  }
  return (
    <div className="inline-flex h-12 flex-none items-center rounded-full border border-line-strong bg-paper" role="group" aria-label={quantityLabel}>
      <button type="button" disabled={disabled} onClick={onDecrease} aria-label={decreaseLabel} className="press press-round grid h-12 w-12 place-items-center rounded-full text-accent-strong active:bg-accent-soft disabled:text-ink-faint">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <output aria-live="polite" className="h-7 min-w-9 overflow-hidden text-center text-lg font-bold leading-7 tabular-nums">
        <span key={value} className="anim-flip inline-block">{value}</span>
      </output>
      <button type="button" disabled={disabled} onClick={onIncrease} aria-label={increaseLabel} className="press press-round grid h-12 w-12 place-items-center rounded-full text-accent-strong active:bg-accent-soft disabled:text-ink-faint">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

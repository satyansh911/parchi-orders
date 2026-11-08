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
      <button type="button" disabled={disabled} onClick={onIncrease} className="min-h-12 min-w-24 rounded-full bg-accent px-5 text-base font-semibold text-paper disabled:bg-paper-dim disabled:text-ink-faint">
        {addLabel}
      </button>
    );
  }
  return (
    <div className="flex items-center rounded-full border border-accent" role="group" aria-label={quantityLabel}>
      <button type="button" disabled={disabled} onClick={onDecrease} aria-label={decreaseLabel} className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-semibold text-accent disabled:opacity-50">
        −
      </button>
      <output aria-live="polite" className="min-w-10 text-center text-lg font-bold tabular-nums">{value}</output>
      <button type="button" disabled={disabled} onClick={onIncrease} aria-label={increaseLabel} className="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-semibold text-accent disabled:opacity-50">
        +
      </button>
    </div>
  );
}

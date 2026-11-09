"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-11 rounded-card border border-accent px-4 text-sm font-medium text-accent print:hidden">
      Print
    </button>
  );
}

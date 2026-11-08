import type { Translate } from "@/i18n/messages";

const TONE: Record<string, string> = {
  PENDING_REVIEW: "bg-paper-dim text-ink",
  CREDIT_HOLD: "bg-warn-soft text-warn",
  REVIEW_REQUIRED: "bg-warn-soft text-warn",
  APPROVED: "bg-ok-soft text-ok",
  EXPORTED: "bg-accent-soft text-accent-strong",
  CANCELLED: "bg-danger-soft text-danger",
  DRAFT: "bg-paper-dim text-ink-muted",
};

export function StatusBadge({ status, t }: { status: string; t: Translate }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status] ?? TONE.DRAFT}`}>{t(`status.${status}` as Parameters<Translate>[0])}</span>;
}

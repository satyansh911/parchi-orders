// Desk screens are English-only (D11 scope trim); retailer screens are bilingual.
export const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Pending review", CREDIT_HOLD: "Credit hold", REVIEW_REQUIRED: "Review required",
  APPROVED: "Approved", EXPORTED: "Exported", CANCELLED: "Cancelled", DRAFT: "Draft",
};
const TONE: Record<string, string> = {
  PENDING_REVIEW: "bg-paper-dim text-ink", CREDIT_HOLD: "bg-warn-soft text-warn", REVIEW_REQUIRED: "bg-warn-soft text-warn",
  APPROVED: "bg-ok-soft text-ok", EXPORTED: "bg-accent-soft text-accent-strong", CANCELLED: "bg-danger-soft text-danger", DRAFT: "bg-paper-dim",
};
export function DeskStatus({ status }: { status: string }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status] ?? ""}`}>{STATUS_LABEL[status] ?? status}</span>;
}
export const dateTime = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

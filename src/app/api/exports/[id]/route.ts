import { AccessError } from "@/server/auth/access-error";
import { getViewer } from "@/server/auth/viewer";
import { exportBatchCsv } from "@/server/data/desk";
import { db } from "@/server/db";

// Re-download a stored batch byte-identically (D29). Desk only; anyone else
// gets 404. Read-only, so no Origin check is needed; never cached.
export async function GET(_request: Request, { params }: RouteContext<"/api/exports/[id]">) {
  const viewer = await getViewer();
  if (!viewer) return new Response("Not found", { status: 404 });
  try {
    const { id } = await params;
    const batch = await exportBatchCsv(db, viewer, id);
    return new Response(batch.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="parchi-tally-batch-${batch.number}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AccessError) return new Response("Not found", { status: 404 });
    throw error;
  }
}

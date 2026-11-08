import { Suspense } from "react";
import { requirePageViewer } from "@/server/auth/viewer";
import { LogoutButton } from "@/ui/logout-button";

// Placeholder desk home (Phase 3). The order queue is Phase 6.
export default function DeskPage() {
  return (
    <main className="mx-auto max-w-3xl p-4">
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <DeskHome />
      </Suspense>
    </main>
  );
}

async function DeskHome() {
  const viewer = await requirePageViewer("DESK", "/desk");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Order desk</h1>
      <p className="text-sm text-neutral-600">Signed in as {viewer.name}. The order queue arrives in Phase 6.</p>
      <LogoutButton />
    </div>
  );
}

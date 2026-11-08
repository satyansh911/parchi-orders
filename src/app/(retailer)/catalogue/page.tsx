import { Suspense } from "react";
import { requirePageViewer } from "@/server/auth/viewer";
import { LogoutButton } from "@/ui/logout-button";

// Placeholder retailer home (Phase 3). The catalogue itself is Phase 4.
export default function CataloguePage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <RetailerHome />
      </Suspense>
    </main>
  );
}

async function RetailerHome() {
  const viewer = await requirePageViewer("RETAILER", "/catalogue");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Namaste, {viewer.name}</h1>
      <p className="text-sm text-neutral-600">Retailer home. The catalogue arrives in Phase 4.</p>
      <LogoutButton />
    </div>
  );
}

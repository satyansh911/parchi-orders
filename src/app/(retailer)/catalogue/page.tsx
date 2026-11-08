import { Suspense } from "react";
import { requirePageViewer } from "@/server/auth/viewer";

// Placeholder retailer home until the catalogue (next commit).
export default function CataloguePage() {
  return (
    <main className="p-4">
      <Suspense fallback={<p className="text-sm text-ink-muted">…</p>}>
        <RetailerHome />
      </Suspense>
    </main>
  );
}

async function RetailerHome() {
  const viewer = await requirePageViewer("RETAILER", "/catalogue");
  return <h1 className="text-xl font-semibold">Namaste, {viewer.name}</h1>;
}

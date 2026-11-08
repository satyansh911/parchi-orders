import { Suspense } from "react";
import { getTranslator, pickStrings } from "@/i18n/server";
import { requirePageViewer } from "@/server/auth/viewer";
import { getCatalogue } from "@/server/catalogue/catalogue";
import { db } from "@/server/db";
import { CatalogueView } from "./catalogue-view";
import { STEPPER_STRING_KEYS } from "../cart/strings";
import { CATALOGUE_STRING_KEYS } from "./strings";

export const metadata = { title: "Catalogue · Parchi Orders" };

export default function CataloguePage() {
  return (
    <main className="px-4 pb-6">
      <Suspense fallback={<CatalogueSkeleton />}>
        <CatalogueContent />
      </Suspense>
    </main>
  );
}

async function CatalogueContent() {
  // Role check happens before any catalogue data is loaded (D73, D91).
  const viewer = await requirePageViewer("RETAILER", "/catalogue");
  const [{ locale, t }, catalogue] = await Promise.all([getTranslator(), getCatalogue(db, viewer, new Date())]);
  return (
    <div lang={locale}>
      <h1 className="sr-only">{t("catalogue.title")}</h1>
      <CatalogueView
        userId={viewer.userId}
        items={catalogue.items}
        categories={catalogue.categories}
        locale={locale}
        s={pickStrings(t, CATALOGUE_STRING_KEYS)}
        stepper={pickStrings(t, STEPPER_STRING_KEYS)}
      />
    </div>
  );
}

function CatalogueSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-3" aria-busy="true">
      <div className="h-12 animate-pulse rounded-card bg-paper-dim" />
      <div className="flex gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 w-20 animate-pulse rounded-full bg-paper-dim" />)}</div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 rounded-card border border-line p-3">
          <div className="h-[88px] w-[88px] animate-pulse rounded-card bg-paper-dim" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-paper-dim" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-paper-dim" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-paper-dim" />
          </div>
        </div>
      ))}
    </div>
  );
}

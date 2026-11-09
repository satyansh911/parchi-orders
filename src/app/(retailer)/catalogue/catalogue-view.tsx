"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { matchesQuery } from "@/domain/catalogue/search";
import { fill } from "@/i18n/fill";
import type { Locale } from "@/i18n/messages";
import type { CatalogueCategory, CatalogueItem } from "@/server/catalogue/catalogue";
import { CatalogueStepper } from "../cart/cart-controls";
import { casesFor } from "../cart/cart-state";
import { useCart } from "../cart/use-cart";
import type { StepperStrings } from "../cart/strings";
import { ProductRow } from "./product-row";
import type { CatalogueStrings } from "./strings";

// Instant client-side search and category filter (D82). Search and category
// live in the URL (replaceState: no server round trip per keystroke) so the
// back button and a shared link keep them.
export function CatalogueView({ userId, items, categories, locale, s, stepper }: { userId: string; items: CatalogueItem[]; categories: CatalogueCategory[]; locale: Locale; s: CatalogueStrings; stepper: StepperStrings }) {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("c") ?? "");
  const { cart } = useCart(userId);

  function sync(next: { q?: string; c?: string }) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(next)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (!category || item.categorySlug === category) &&
          matchesQuery(item, query),
      ),
    [items, category, query],
  );

  if (items.length === 0) return <p className="p-6 text-center text-ink-muted">{s["catalogue.empty"]}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-14 z-10 flex flex-col gap-2 bg-bg pb-2 pt-3">
        <label htmlFor="catalogue-search" className="sr-only">{s["catalogue.searchLabel"]}</label>
        <div className="flex min-h-12 items-center gap-2.5 rounded-full border border-line-strong bg-paper px-4 text-ink-faint focus-within:border-accent">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input
          id="catalogue-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={s["catalogue.searchPlaceholder"]}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            sync({ q: e.target.value });
          }}
          className="min-h-11 w-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none"
        />
        </div>
        <div role="group" aria-label={s["catalogue.categories"]} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ slug: "", label: s["catalogue.allCategories"] }, ...categories.map((c) => ({ slug: c.slug, label: locale === "hi" ? c.nameHi : c.nameEn }))].map(
            (chip) => (
              <button
                key={chip.slug || "all"}
                type="button"
                aria-pressed={category === chip.slug}
                onClick={() => {
                  setCategory(chip.slug);
                  sync({ c: chip.slug });
                }}
                className={`press min-h-11 shrink-0 rounded-full border px-4 text-sm ${category === chip.slug ? "border-accent bg-accent-soft font-bold text-accent-strong" : "border-line-strong bg-paper font-medium text-ink"}`}
              >
                {chip.label}
              </button>
            ),
          )}
        </div>
        <p className="text-xs text-ink-muted" aria-live="polite">{fill(s["catalogue.resultCount"], { n: visible.length })}</p>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-ink-muted">{fill(s["catalogue.noMatch"], { query })}</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("");
              sync({ q: "", c: "" });
            }}
            className="min-h-11 rounded-full border border-accent px-4 text-sm font-medium text-accent"
          >
            {s["catalogue.clearSearch"]}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ProductRow
              key={item.id}
              item={item}
              locale={locale}
              s={s}
              cases={casesFor(cart, item.id)}
              action={<CatalogueStepper userId={userId} skuId={item.id} name={locale === "hi" ? item.nameHi : item.nameEn} disabled={item.stock.status === "OUT"} s={stepper} />}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

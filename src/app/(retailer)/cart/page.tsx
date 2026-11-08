import { Suspense } from "react";
import { getTranslator, pickStrings } from "@/i18n/server";
import { requirePageViewer } from "@/server/auth/viewer";
import { CartView } from "./cart-view";
import { CART_STRING_KEYS } from "./strings";

export const metadata = { title: "Cart · Parchi Orders" };

export default function CartPage() {
  return (
    <main className="px-4 pb-28">
      <Suspense fallback={<div className="mt-4 h-40 animate-pulse rounded-card bg-paper-dim" />}>
        <CartContent />
      </Suspense>
    </main>
  );
}

async function CartContent() {
  // Role check before anything else (D73, D91); prices come only from the server preview.
  const viewer = await requirePageViewer("RETAILER", "/cart");
  const { locale, t } = await getTranslator();
  return (
    <div lang={locale}>
      <h1 className="pt-4 text-xl font-semibold">{t("cart.title")}</h1>
      <CartView userId={viewer.userId} locale={locale} s={pickStrings(t, CART_STRING_KEYS)} />
    </div>
  );
}

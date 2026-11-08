import type { MetadataRoute } from "next";
import { BRAND_TEAL } from "./icon";

// Installable-app basics (D86): manifest and icons only. Deliberately no
// service worker: offline ordering is deferred, and a page cache could keep
// a retailer's private prices on a shared phone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parchi Orders",
    short_name: "Parchi",
    description: "स्टॉक, अपना दाम और स्कीम देखें, एक मिनट में ऑर्डर करें। · See stock, your price and schemes; order in a minute.",
    lang: "hi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: BRAND_TEAL,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_BOOT } from "@/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Parchi Orders",
  description: "Order stock, see your price and current schemes.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1513" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <head>
        {/* D114: apply a saved Light/Dark choice before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

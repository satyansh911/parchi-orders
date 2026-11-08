import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parchi Orders",
  description: "Order stock, see your price and current schemes.",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hi">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

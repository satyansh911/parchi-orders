import { ImageResponse } from "next/og";

// App icons generated at build time (no image tooling needed): a white order
// slip ("parchi") on the teal accent. No text, so no font/glyph issues.
export const BRAND_TEAL = "#0f766e";
export const contentType = "image/png";

type IconStyle = { size: number; rounded: boolean; slipShare: number };

const ICONS: Record<string, IconStyle> = {
  "192": { size: 192, rounded: true, slipShare: 0.58 },
  "512": { size: 512, rounded: true, slipShare: 0.58 },
  // Maskable: full bleed, content inside the central 80% safe zone.
  maskable: { size: 512, rounded: false, slipShare: 0.46 },
};

export function generateImageMetadata() {
  return Object.entries(ICONS).map(([id, { size }]) => ({ id, size: { width: size, height: size }, contentType }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  return renderIcon(ICONS[String(await id)] ?? ICONS["192"]);
}

export function renderIcon({ size: s, rounded, slipShare }: IconStyle): ImageResponse {
  const w = Math.round(s * slipShare * 0.78);
  const h = Math.round(s * slipShare);
  const line = (width: number) => (
    <div style={{ width: Math.round(w * width), height: Math.max(2, Math.round(s * 0.035)), background: BRAND_TEAL, borderRadius: s, opacity: 0.85 }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND_TEAL, borderRadius: rounded ? Math.round(s * 0.22) : 0 }}>
        <div style={{ width: w, height: h, background: "#ffffff", borderRadius: Math.round(s * 0.05), display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(s * 0.05), paddingLeft: Math.round(w * 0.16) }}>
          {line(0.66)}
          {line(0.5)}
          {line(0.6)}
          {line(0.36)}
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}

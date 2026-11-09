// Product pack illustrations (D25, redesign). Each product = its pack shape
// (from the catalogue's imageKey) + a motif picked from its name + a pack
// colour, with the fictional brand on the band and the pack size on a label.
// All shapes and motifs live in one sprite (<PackSprite/>, sent once per
// page), so each image is a few hundred bytes and needs no network request.
// Decorative: the product name is always shown next to it.

import { PACK_SPRITE } from "./pack-sprite";

type Shape = "pouch" | "carton" | "bottle" | "packet" | "box" | "bag" | "bar";

const BRANDS: Record<string, { short: string; br: string; br2: string }> = {
  "Rewa Foods": { short: "Rewa", br: "#C2410C", br2: "#7C2D12" },
  "Kanha Chai": { short: "Kanha", br: "#3730A3", br2: "#1E1B4B" },
  "Bhedaghat Masale": { short: "Bhedaghat", br: "#7F1D1D", br2: "#450A0A" },
  "Sitara Home Care": { short: "Sitara", br: "#1D4ED8", br2: "#1E3A8A" },
};

// Where the motif, brand and size sit on each shape (from the design).
const LAYOUT: Record<Shape, { m: [number, number, number]; bt: [number, number]; lt: [number, number] }> = {
  packet: { m: [33, 38, 22], bt: [44, 31.3], lt: [67.5, 59] },
  box: { m: [26, 49, 20], bt: [40, 41.3], lt: [58, 69.8] },
  pouch: { m: [33, 37, 22], bt: [44, 28.8], lt: [44, 71.6] },
  bag: { m: [34, 46, 20], bt: [44, 38.6], lt: [44, 75.6] },
  carton: { m: [30, 41, 22], bt: [41, 32.3], lt: [41, 73.7] },
  bottle: { m: [35, 49, 18], bt: [44, 43.3], lt: [44, 75.2] },
  bar: { m: [32.5, 50.5, 15], bt: [44, 44.8], lt: [65, 60.7] },
};

// First match wins: [name pattern, motif, pack colour, bottle top].
const MOTIFS: Array<[RegExp, string, string, string?]> = [
  [/cookie/i, "cookie", "#F2D3A8"],
  [/cracker/i, "cracker", "#F7E6BC"],
  [/chips/i, "chips", "#F9D65C"],
  [/bhujia|mixture|namkeen/i, "namkeen", "#F4A340"],
  [/cream biscuit/i, "biscuit", "#F3DCE6"],
  [/marie/i, "biscuit", "#EAD7B7"],
  [/biscuit/i, "biscuit", "#FBF3E1"],
  [/green tea/i, "teabag", "#CFE3C4"],
  [/bags/i, "teabag", "#EFE8D8"],
  [/tea masala|garam masala|masala/i, "masala", "#A55A33"],
  [/tea dust/i, "leaf", "#6B4A2E"],
  [/tea/i, "leaf", "#2F7D4E"],
  [/turmeric|haldi/i, "turmeric", "#F5C518"],
  [/chilli/i, "chilli", "#D9372B"],
  [/coriander|dhania/i, "coriander", "#8DB255"],
  [/dishwash/i, "dish", "#D6EFA0", "cap"],
  [/floor/i, "floor", "#E4D8F5", "cap"],
  [/toilet/i, "toilet", "#D3E9F5", "nozzle"],
  [/glass/i, "glass", "#D7F0F7", "trigger"],
  [/phenyl/i, "phenyl", "#D3EBDC", "cap"],
  [/liquid/i, "swirl", "#C7DAFF", "cap"],
  [/detergent/i, "swirl", "#DCE8FF"],
];

/** "75 g" → "75g", "1 L" → "1L", "25 bags" → "25". */
const sizeLabel = (packSize: string) => packSize.replace(/\s+/g, "").replace(/bags?$/i, "").slice(0, 6);

/** Render once per page, before any <PackImage>. */
export function PackSprite() {
  return <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: `<defs>${PACK_SPRITE}</defs>` }} />;
}

export function PackImage({ shape, brand, name, packSize, size = 88 }: { shape: string; brand: string; name: string; packSize: string; size?: number }) {
  const s = (shape in LAYOUT ? shape : "box") as Shape;
  const layout = LAYOUT[s];
  const [, motif, pk, top] = MOTIFS.find(([re]) => re.test(name)) ?? [/./, "biscuit", "#EFE8D8"];
  const b = BRANDS[brand] ?? { short: brand.split(" ")[0], br: "#465350", br2: "#22302D" };
  const style = { width: size, height: size, "--pk": pk, "--br": b.br, "--br2": b.br2 } as React.CSSProperties;
  return (
    <svg viewBox="0 0 88 88" style={style} className="pack-art" aria-hidden="true" focusable="false">
      <use href={`#s-${s}`} />
      {s === "bottle" && <use href={`#p-${top ?? "cap"}`} />}
      <use href={`#m-${motif}`} x={layout.m[0]} y={layout.m[1]} width={layout.m[2]} height={layout.m[2]} />
      <text className="pack-bt" x={layout.bt[0]} y={layout.bt[1]} textAnchor="middle">{b.short}</text>
      <text className="pack-lt" x={layout.lt[0]} y={layout.lt[1]} textAnchor="middle">{sizeLabel(packSize)}</text>
    </svg>
  );
}

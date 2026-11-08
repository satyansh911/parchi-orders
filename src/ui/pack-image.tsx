// Lightweight SVG pack illustrations (D25): one simple silhouette per pack
// shape, tinted by brand. A few hundred bytes each, no image requests on 3G.
// Decorative: the product name is always shown next to it.

const BRAND_TINT: Record<string, { fill: string; ink: string }> = {
  "Rewa Foods": { fill: "#f6e7d3", ink: "#9a5b13" },
  "Kanha Chai": { fill: "#e3eedc", ink: "#3f6212" },
  "Sitara Home Care": { fill: "#dfe8f6", ink: "#1e40af" },
  "Bhedaghat Masale": { fill: "#f6e0dc", ink: "#9f1d1d" },
};
const FALLBACK = { fill: "#ececea", ink: "#5b5b61" };

const SHAPES: Record<string, (c: { fill: string; ink: string }) => React.ReactNode> = {
  box: (c) => <><rect x="22" y="14" width="44" height="60" rx="4" fill={c.fill} stroke={c.ink} strokeWidth="2.5" /><rect x="22" y="34" width="44" height="14" fill={c.ink} opacity=".85" /></>,
  packet: (c) => <><path d="M18 22 L70 22 L66 70 L22 70 Z" fill={c.fill} stroke={c.ink} strokeWidth="2.5" strokeLinejoin="round" /><path d="M18 22 l4 -6 h44 l4 6" fill="none" stroke={c.ink} strokeWidth="2.5" /><circle cx="44" cy="46" r="9" fill={c.ink} opacity=".85" /></>,
  pouch: (c) => <><path d="M26 14 h36 l4 52 a8 8 0 0 1 -8 8 h-28 a8 8 0 0 1 -8 -8 Z" fill={c.fill} stroke={c.ink} strokeWidth="2.5" strokeLinejoin="round" /><path d="M26 22 h36" stroke={c.ink} strokeWidth="2.5" /><rect x="32" y="38" width="24" height="16" rx="3" fill={c.ink} opacity=".85" /></>,
  carton: (c) => <><path d="M20 30 L44 18 L68 30 L68 68 L20 68 Z" fill={c.fill} stroke={c.ink} strokeWidth="2.5" strokeLinejoin="round" /><path d="M20 30 L68 30" stroke={c.ink} strokeWidth="2.5" /><rect x="30" y="40" width="28" height="12" rx="2" fill={c.ink} opacity=".85" /></>,
  bag: (c) => <><path d="M20 20 h48 v50 a4 4 0 0 1 -4 4 h-40 a4 4 0 0 1 -4 -4 Z" fill={c.fill} stroke={c.ink} strokeWidth="2.5" /><path d="M20 20 l6 -6 h36 l6 6" fill="none" stroke={c.ink} strokeWidth="2.5" /><circle cx="44" cy="46" r="12" fill="none" stroke={c.ink} strokeWidth="4" opacity=".85" /></>,
  bar: (c) => <><rect x="12" y="32" width="64" height="26" rx="8" fill={c.fill} stroke={c.ink} strokeWidth="2.5" /><rect x="30" y="40" width="28" height="10" rx="5" fill={c.ink} opacity=".85" /></>,
  bottle: (c) => <><path d="M38 10 h12 v10 l8 10 v40 a4 4 0 0 1 -4 4 h-20 a4 4 0 0 1 -4 -4 v-40 l8 -10 Z" fill={c.fill} stroke={c.ink} strokeWidth="2.5" strokeLinejoin="round" /><rect x="34" y="44" width="20" height="16" rx="2" fill={c.ink} opacity=".85" /></>,
};

export function PackImage({ shape, brand, size = 88 }: { shape: string; brand: string; size?: number }) {
  const tint = BRAND_TINT[brand] ?? FALLBACK;
  const draw = SHAPES[shape] ?? SHAPES.box;
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden="true" focusable="false" className="shrink-0 rounded-card bg-paper-dim">
      {draw(tint)}
    </svg>
  );
}

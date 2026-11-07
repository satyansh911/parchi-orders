// Synthetic demo catalogue (D37). Brands are fictional; prices, MRP, stock and
// GST rates are demo values, not real commercial or tax data (C.21, D35).
//
// The three SKUs marked BRIEF are copied exactly from the client brief.
// Dealer prices are per piece (A.1, C.3); case price = piece price x pieces per case.

export const BRANDS = [
  "Rewa Foods",
  "Kanha Chai",
  "Sitara Home Care",
  "Bhedaghat Masale",
] as const;
export type BrandName = (typeof BRANDS)[number];

export const CATEGORIES = [
  { slug: "biscuits", nameEn: "Biscuits", nameHi: "बिस्कुट", sortOrder: 1 },
  { slug: "snacks", nameEn: "Snacks", nameHi: "नमकीन", sortOrder: 2 },
  { slug: "tea", nameEn: "Tea", nameHi: "चाय", sortOrder: 3 },
  { slug: "spices", nameEn: "Spices", nameHi: "मसाले", sortOrder: 4 },
  { slug: "detergent", nameEn: "Detergent", nameHi: "डिटर्जेंट", sortOrder: 5 },
  { slug: "cleaners", nameEn: "Cleaners", nameHi: "सफ़ाई", sortOrder: 6 },
] as const;
export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

/**
 * Demo GST in basis points, stored per SKU (D35).
 * Biscuits, tea: 5%; detergent: 18% (approved in D35).
 * Snacks and spices 5%, cleaners 18% follow the same food / home-care split
 * and are also demo assumptions. All must be verified against HSN codes.
 */
export const DEMO_GST_BPS: Record<CategorySlug, number> = {
  biscuits: 500,
  snacks: 500,
  tea: 500,
  spices: 500,
  detergent: 1800,
  cleaners: 1800,
};

/** Keys of the SVG pack illustrations (D25). */
export type PackShape = "box" | "packet" | "pouch" | "carton" | "bag" | "bar" | "bottle";

export type SeedSku = {
  code: string;
  nameEn: string;
  nameHi: string;
  brand: BrandName;
  category: CategorySlug;
  packSize: string;
  piecesPerCase: number;
  dealerPricePaise: number;
  mrpPaise: number;
  stockCases: number;
  imageKey: PackShape;
};

export const BRIEF_SKU_CODES = ["SKU-BS-075", "SKU-DT-1KG", "SKU-TE-250"] as const;

export const SKUS: SeedSku[] = [
  // ── Rewa Foods: biscuits ──
  // BRIEF: Glucose biscuit 75 g, case of 96, ₹8.10, 340 cases, Buy 10 cases get 1 free.
  { code: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", nameHi: "ग्लूकोज़ बिस्कुट 75 ग्राम", brand: "Rewa Foods", category: "biscuits", packSize: "75 g", piecesPerCase: 96, dealerPricePaise: 810, mrpPaise: 1000, stockCases: 340, imageKey: "box" },
  { code: "SKU-BS-150", nameEn: "Glucose biscuit 150 g", nameHi: "ग्लूकोज़ बिस्कुट 150 ग्राम", brand: "Rewa Foods", category: "biscuits", packSize: "150 g", piecesPerCase: 48, dealerPricePaise: 1620, mrpPaise: 2000, stockCases: 210, imageKey: "box" },
  { code: "SKU-CR-100", nameEn: "Cream biscuit 100 g", nameHi: "क्रीम बिस्कुट 100 ग्राम", brand: "Rewa Foods", category: "biscuits", packSize: "100 g", piecesPerCase: 60, dealerPricePaise: 2430, mrpPaise: 3000, stockCases: 50, imageKey: "packet" },
  { code: "SKU-MR-120", nameEn: "Marie biscuit 120 g", nameHi: "मैरी बिस्कुट 120 ग्राम", brand: "Rewa Foods", category: "biscuits", packSize: "120 g", piecesPerCase: 60, dealerPricePaise: 1620, mrpPaise: 2000, stockCases: 180, imageKey: "packet" },
  { code: "SKU-CK-200", nameEn: "Butter cookies 200 g", nameHi: "बटर कुकीज़ 200 ग्राम", brand: "Rewa Foods", category: "biscuits", packSize: "200 g", piecesPerCase: 36, dealerPricePaise: 4050, mrpPaise: 5000, stockCases: 18, imageKey: "box" },
  { code: "SKU-SL-100", nameEn: "Salted crackers 100 g", nameHi: "नमकीन क्रैकर्स 100 ग्राम", brand: "Rewa Foods", category: "biscuits", packSize: "100 g", piecesPerCase: 60, dealerPricePaise: 1620, mrpPaise: 2000, stockCases: 120, imageKey: "packet" },
  // ── Rewa Foods: snacks ──
  { code: "SKU-NM-200", nameEn: "Aloo bhujia 200 g", nameHi: "आलू भुजिया 200 ग्राम", brand: "Rewa Foods", category: "snacks", packSize: "200 g", piecesPerCase: 40, dealerPricePaise: 4050, mrpPaise: 5000, stockCases: 95, imageKey: "pouch" },
  { code: "SKU-NM-400", nameEn: "Aloo bhujia 400 g", nameHi: "आलू भुजिया 400 ग्राम", brand: "Rewa Foods", category: "snacks", packSize: "400 g", piecesPerCase: 24, dealerPricePaise: 8100, mrpPaise: 10000, stockCases: 60, imageKey: "pouch" },
  { code: "SKU-MX-200", nameEn: "Mixture namkeen 200 g", nameHi: "मिक्सचर नमकीन 200 ग्राम", brand: "Rewa Foods", category: "snacks", packSize: "200 g", piecesPerCase: 40, dealerPricePaise: 4050, mrpPaise: 5000, stockCases: 70, imageKey: "pouch" },
  { code: "SKU-CH-050", nameEn: "Potato chips 50 g", nameHi: "आलू चिप्स 50 ग्राम", brand: "Rewa Foods", category: "snacks", packSize: "50 g", piecesPerCase: 120, dealerPricePaise: 1620, mrpPaise: 2000, stockCases: 140, imageKey: "packet" },

  // ── Kanha Chai: tea ──
  // BRIEF: Tea leaf 250 g, case of 40, ₹118.00, 0 cases, no scheme.
  { code: "SKU-TE-250", nameEn: "Tea leaf 250 g", nameHi: "चाय पत्ती 250 ग्राम", brand: "Kanha Chai", category: "tea", packSize: "250 g", piecesPerCase: 40, dealerPricePaise: 11800, mrpPaise: 14000, stockCases: 0, imageKey: "pouch" },
  { code: "SKU-TE-100", nameEn: "Tea leaf 100 g", nameHi: "चाय पत्ती 100 ग्राम", brand: "Kanha Chai", category: "tea", packSize: "100 g", piecesPerCase: 100, dealerPricePaise: 4800, mrpPaise: 5500, stockCases: 150, imageKey: "pouch" },
  { code: "SKU-TE-500", nameEn: "Tea leaf 500 g", nameHi: "चाय पत्ती 500 ग्राम", brand: "Kanha Chai", category: "tea", packSize: "500 g", piecesPerCase: 24, dealerPricePaise: 23200, mrpPaise: 27000, stockCases: 75, imageKey: "pouch" },
  { code: "SKU-TE-1KG", nameEn: "Tea leaf 1 kg", nameHi: "चाय पत्ती 1 किलो", brand: "Kanha Chai", category: "tea", packSize: "1 kg", piecesPerCase: 12, dealerPricePaise: 45500, mrpPaise: 52000, stockCases: 40, imageKey: "pouch" },
  { code: "SKU-TD-250", nameEn: "Tea dust 250 g", nameHi: "चाय डस्ट 250 ग्राम", brand: "Kanha Chai", category: "tea", packSize: "250 g", piecesPerCase: 40, dealerPricePaise: 10500, mrpPaise: 12500, stockCases: 90, imageKey: "pouch" },
  { code: "SKU-ET-025", nameEn: "Elaichi tea, 25 bags", nameHi: "इलायची चाय, 25 टी-बैग", brand: "Kanha Chai", category: "tea", packSize: "25 bags", piecesPerCase: 48, dealerPricePaise: 6500, mrpPaise: 7500, stockCases: 30, imageKey: "carton" },
  { code: "SKU-GT-025", nameEn: "Green tea, 25 bags", nameHi: "ग्रीन टी, 25 टी-बैग", brand: "Kanha Chai", category: "tea", packSize: "25 bags", piecesPerCase: 48, dealerPricePaise: 9800, mrpPaise: 11500, stockCases: 12, imageKey: "carton" },
  { code: "SKU-TM-050", nameEn: "Tea masala 50 g", nameHi: "चाय मसाला 50 ग्राम", brand: "Kanha Chai", category: "tea", packSize: "50 g", piecesPerCase: 96, dealerPricePaise: 3400, mrpPaise: 4000, stockCases: 64, imageKey: "carton" },

  // ── Sitara Home Care: detergent ──
  // BRIEF: Detergent powder 1 kg, case of 20, ₹101.50, 85 cases, 3% off 5 or more cases.
  { code: "SKU-DT-1KG", nameEn: "Detergent powder 1 kg", nameHi: "डिटर्जेंट पाउडर 1 किलो", brand: "Sitara Home Care", category: "detergent", packSize: "1 kg", piecesPerCase: 20, dealerPricePaise: 10150, mrpPaise: 13000, stockCases: 85, imageKey: "bag" },
  { code: "SKU-DT-500", nameEn: "Detergent powder 500 g", nameHi: "डिटर्जेंट पाउडर 500 ग्राम", brand: "Sitara Home Care", category: "detergent", packSize: "500 g", piecesPerCase: 40, dealerPricePaise: 5200, mrpPaise: 6500, stockCases: 160, imageKey: "bag" },
  { code: "SKU-DT-2KG", nameEn: "Detergent powder 2 kg", nameHi: "डिटर्जेंट पाउडर 2 किलो", brand: "Sitara Home Care", category: "detergent", packSize: "2 kg", piecesPerCase: 10, dealerPricePaise: 19800, mrpPaise: 25000, stockCases: 55, imageKey: "bag" },
  { code: "SKU-DB-150", nameEn: "Detergent bar 150 g", nameHi: "डिटर्जेंट बार 150 ग्राम", brand: "Sitara Home Care", category: "detergent", packSize: "150 g", piecesPerCase: 100, dealerPricePaise: 850, mrpPaise: 1000, stockCases: 230, imageKey: "bar" },
  { code: "SKU-LQ-1L", nameEn: "Liquid detergent 1 L", nameHi: "लिक्विड डिटर्जेंट 1 लीटर", brand: "Sitara Home Care", category: "detergent", packSize: "1 L", piecesPerCase: 12, dealerPricePaise: 16500, mrpPaise: 21000, stockCases: 25, imageKey: "bottle" },
  // ── Sitara Home Care: cleaners ──
  { code: "SKU-DW-500", nameEn: "Dishwash liquid 500 ml", nameHi: "बर्तन धोने का लिक्विड 500 मि.ली.", brand: "Sitara Home Care", category: "cleaners", packSize: "500 ml", piecesPerCase: 24, dealerPricePaise: 8200, mrpPaise: 10500, stockCases: 70, imageKey: "bottle" },
  { code: "SKU-DW-200", nameEn: "Dishwash bar 200 g", nameHi: "बर्तन साबुन 200 ग्राम", brand: "Sitara Home Care", category: "cleaners", packSize: "200 g", piecesPerCase: 72, dealerPricePaise: 1650, mrpPaise: 2000, stockCases: 300, imageKey: "bar" },
  { code: "SKU-FC-1L", nameEn: "Floor cleaner 1 L", nameHi: "फ़र्श क्लीनर 1 लीटर", brand: "Sitara Home Care", category: "cleaners", packSize: "1 L", piecesPerCase: 12, dealerPricePaise: 13800, mrpPaise: 17500, stockCases: 40, imageKey: "bottle" },
  { code: "SKU-TC-500", nameEn: "Toilet cleaner 500 ml", nameHi: "टॉयलेट क्लीनर 500 मि.ली.", brand: "Sitara Home Care", category: "cleaners", packSize: "500 ml", piecesPerCase: 24, dealerPricePaise: 7400, mrpPaise: 9500, stockCases: 0, imageKey: "bottle" },
  { code: "SKU-GC-500", nameEn: "Glass cleaner 500 ml", nameHi: "काँच क्लीनर 500 मि.ली.", brand: "Sitara Home Care", category: "cleaners", packSize: "500 ml", piecesPerCase: 24, dealerPricePaise: 7800, mrpPaise: 9900, stockCases: 15, imageKey: "bottle" },
  { code: "SKU-PH-1L", nameEn: "Phenyl 1 L", nameHi: "फिनाइल 1 लीटर", brand: "Sitara Home Care", category: "cleaners", packSize: "1 L", piecesPerCase: 12, dealerPricePaise: 6800, mrpPaise: 8500, stockCases: 48, imageKey: "bottle" },

  // ── Bhedaghat Masale: spices ──
  { code: "SKU-HL-100", nameEn: "Turmeric powder 100 g", nameHi: "हल्दी पाउडर 100 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "100 g", piecesPerCase: 100, dealerPricePaise: 2700, mrpPaise: 3200, stockCases: 140, imageKey: "pouch" },
  { code: "SKU-HL-200", nameEn: "Turmeric powder 200 g", nameHi: "हल्दी पाउडर 200 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "200 g", piecesPerCase: 50, dealerPricePaise: 5200, mrpPaise: 6200, stockCases: 80, imageKey: "pouch" },
  { code: "SKU-CP-100", nameEn: "Red chilli powder 100 g", nameHi: "लाल मिर्च पाउडर 100 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "100 g", piecesPerCase: 100, dealerPricePaise: 3800, mrpPaise: 4500, stockCases: 120, imageKey: "pouch" },
  { code: "SKU-DH-100", nameEn: "Coriander powder 100 g", nameHi: "धनिया पाउडर 100 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "100 g", piecesPerCase: 100, dealerPricePaise: 2500, mrpPaise: 3000, stockCases: 110, imageKey: "pouch" },
  { code: "SKU-GM-100", nameEn: "Garam masala 100 g", nameHi: "गरम मसाला 100 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "100 g", piecesPerCase: 60, dealerPricePaise: 6200, mrpPaise: 7500, stockCases: 65, imageKey: "carton" },
  { code: "SKU-KK-100", nameEn: "Kitchen king masala 100 g", nameHi: "किचन किंग मसाला 100 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "100 g", piecesPerCase: 60, dealerPricePaise: 6800, mrpPaise: 8200, stockCases: 45, imageKey: "carton" },
  { code: "SKU-CM-100", nameEn: "Chhole masala 100 g", nameHi: "छोले मसाला 100 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "100 g", piecesPerCase: 60, dealerPricePaise: 6500, mrpPaise: 7800, stockCases: 52, imageKey: "carton" },
  { code: "SKU-JR-100", nameEn: "Whole jeera 100 g", nameHi: "साबुत जीरा 100 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "100 g", piecesPerCase: 100, dealerPricePaise: 4200, mrpPaise: 5000, stockCases: 20, imageKey: "pouch" },
  { code: "SKU-HG-050", nameEn: "Hing 50 g", nameHi: "हींग 50 ग्राम", brand: "Bhedaghat Masale", category: "spices", packSize: "50 g", piecesPerCase: 48, dealerPricePaise: 7800, mrpPaise: 9500, stockCases: 30, imageKey: "carton" },
];

export type SeedScheme =
  | { skuCode: string; type: "FREE_GOODS"; buyCases: number; freeCases: number; labelEn: string; labelHi: string; startsAt?: Date; endsAt?: Date }
  | { skuCode: string; type: "SLAB_DISCOUNT"; minCases: number; discountBps: number; labelEn: string; labelHi: string; startsAt?: Date; endsAt?: Date };

const freeGoods = (skuCode: string, buyCases: number, freeCases: number): SeedScheme => ({
  skuCode, type: "FREE_GOODS", buyCases, freeCases,
  labelEn: `Buy ${buyCases} cases get ${freeCases} free`,
  labelHi: `${buyCases} पेटी पर ${freeCases} पेटी मुफ़्त`,
});

const slab = (skuCode: string, minCases: number, discountBps: number): SeedScheme => ({
  skuCode, type: "SLAB_DISCOUNT", minCases, discountBps,
  labelEn: `${discountBps / 100}% off on ${minCases} or more cases`,
  labelHi: `${minCases} या ज़्यादा पेटी पर ${discountBps / 100}% छूट`,
});

export const SCHEMES: SeedScheme[] = [
  // BRIEF schemes.
  freeGoods("SKU-BS-075", 10, 1),
  slab("SKU-DT-1KG", 5, 300),
  // D2 / D18 demo: two schemes on one SKU, with stock (50) too low for the full
  // free quantity at 50 paid cases, so the "pick an option" flow can be shown.
  freeGoods("SKU-CR-100", 10, 1),
  slab("SKU-CR-100", 5, 300),
  // Multi-step slab as two rows; best offer picks the higher one (D2).
  slab("SKU-DT-2KG", 5, 300),
  slab("SKU-DT-2KG", 10, 500),
  freeGoods("SKU-TE-500", 20, 1),
  freeGoods("SKU-CP-100", 10, 1),
  slab("SKU-DW-500", 5, 300),
  // Expired scheme: must be ignored by the engine.
  {
    ...slab("SKU-NM-200", 5, 200),
    startsAt: new Date("2026-10-01T00:00:00Z"),
    endsAt: new Date("2026-11-01T00:00:00Z"),
  },
];

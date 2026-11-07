// Synthetic demo people (D37). Shop and owner names are fictional; areas are
// real Jabalpur localities for realism. Phone numbers follow the obviously fake
// 99999xxxxx pattern: desk 9999900001, retailers from 9999900101. OTP is 123456.

export const TIERS = [
  { code: "STANDARD", name: "Standard", discountBps: 0 },
  { code: "KEY_ACCOUNT", name: "Key account", discountBps: 200 },
] as const;
export type TierCode = (typeof TIERS)[number]["code"];

export const DESK_USER = { phone: "9999900001", name: "Order Desk (demo)" } as const;

export type SeedRetailer = {
  code: string;
  shopName: string;
  ownerName: string;
  area: string;
  tier: TierCode;
  creditLimitPaise: number;
  outstandingPaise: number;
};

const rupees = (r: number) => r * 100;

export const RETAILERS: SeedRetailer[] = [
  { code: "R-0001", shopName: "Gupta Kirana Store", ownerName: "Ramesh Gupta", area: "Napier Town", tier: "STANDARD", creditLimitPaise: rupees(100_000), outstandingPaise: rupees(32_400) },
  { code: "R-0002", shopName: "Shree Ganesh General Store", ownerName: "Sunita Jain", area: "Wright Town", tier: "KEY_ACCOUNT", creditLimitPaise: rupees(300_000), outstandingPaise: rupees(118_000) },
  { code: "R-0003", shopName: "Patel Provision", ownerName: "Mahesh Patel", area: "Adhartal", tier: "STANDARD", creditLimitPaise: rupees(75_000), outstandingPaise: rupees(21_500) },
  { code: "R-0004", shopName: "Maa Durga Kirana", ownerName: "Kavita Yadav", area: "Garha", tier: "STANDARD", creditLimitPaise: rupees(50_000), outstandingPaise: rupees(9_800) },
  { code: "R-0005", shopName: "New Bharat Stores", ownerName: "Imran Qureshi", area: "Sadar", tier: "KEY_ACCOUNT", creditLimitPaise: rupees(250_000), outstandingPaise: rupees(64_000) },
  { code: "R-0006", shopName: "Sai Daily Needs", ownerName: "Pooja Tiwari", area: "Vijay Nagar", tier: "STANDARD", creditLimitPaise: rupees(80_000), outstandingPaise: rupees(40_250) },
  // At the limit: any new order goes to CREDIT_HOLD.
  { code: "R-0007", shopName: "Verma Brothers Kirana", ownerName: "Anil Verma", area: "Gorakhpur", tier: "STANDARD", creditLimitPaise: rupees(60_000), outstandingPaise: rupees(60_000) },
  { code: "R-0008", shopName: "Narmada Provision Store", ownerName: "Rekha Dubey", area: "Gwarighat", tier: "STANDARD", creditLimitPaise: rupees(70_000), outstandingPaise: rupees(15_600) },
  { code: "R-0009", shopName: "Shiv Shakti Traders", ownerName: "Deepak Soni", area: "Ranjhi", tier: "STANDARD", creditLimitPaise: rupees(90_000), outstandingPaise: rupees(52_300) },
  { code: "R-0010", shopName: "Agrawal Super Store", ownerName: "Neha Agrawal", area: "Civil Lines", tier: "KEY_ACCOUNT", creditLimitPaise: rupees(280_000), outstandingPaise: rupees(141_500) },
  { code: "R-0011", shopName: "Laxmi Kirana", ownerName: "Suresh Chouksey", area: "Madan Mahal", tier: "STANDARD", creditLimitPaise: rupees(55_000), outstandingPaise: rupees(12_000) },
  // Over the limit by ₹8,500.
  { code: "R-0012", shopName: "Om Sai General Store", ownerName: "Farida Khan", area: "Gohalpur", tier: "STANDARD", creditLimitPaise: rupees(65_000), outstandingPaise: rupees(73_500) },
  { code: "R-0013", shopName: "Rajput Kirana Bhandar", ownerName: "Vikram Singh Rajput", area: "Ghamapur", tier: "STANDARD", creditLimitPaise: rupees(85_000), outstandingPaise: rupees(28_900) },
  { code: "R-0014", shopName: "Jai Ambe Stores", ownerName: "Geeta Vishwakarma", area: "Kanchghar", tier: "STANDARD", creditLimitPaise: rupees(60_000), outstandingPaise: rupees(18_750) },
  { code: "R-0015", shopName: "Mittal Wholesale Point", ownerName: "Rohit Mittal", area: "Bilhari", tier: "KEY_ACCOUNT", creditLimitPaise: rupees(220_000), outstandingPaise: rupees(87_000) },
  { code: "R-0016", shopName: "Sahu Kirana Store", ownerName: "Manoj Sahu", area: "Tilwara", tier: "STANDARD", creditLimitPaise: rupees(50_000), outstandingPaise: rupees(4_200) },
  { code: "R-0017", shopName: "Krishna Provision", ownerName: "Anita Mishra", area: "Shastri Nagar", tier: "STANDARD", creditLimitPaise: rupees(95_000), outstandingPaise: rupees(46_000) },
  // Over the limit by ₹22,000.
  { code: "R-0018", shopName: "Bajrang Kirana", ownerName: "Santosh Kol", area: "Ganjipura", tier: "STANDARD", creditLimitPaise: rupees(70_000), outstandingPaise: rupees(92_000) },
  { code: "R-0019", shopName: "Fresh Mart Kirana", ownerName: "Priya Namdev", area: "Karmeta", tier: "STANDARD", creditLimitPaise: rupees(75_000), outstandingPaise: rupees(33_300) },
  { code: "R-0020", shopName: "Dixit Daily Bazaar", ownerName: "Alok Dixit", area: "Dixitpura", tier: "STANDARD", creditLimitPaise: rupees(65_000), outstandingPaise: rupees(26_100) },
];

/** Retailer R-00NN logs in with 99999001NN. */
export function retailerPhone(code: string): string {
  const n = Number(code.slice(2));
  return `99999${String(100 + n).padStart(5, "0")}`;
}

// Shared vocabulary. SQLite has no enums, so these lists are the source of
// truth for every status-style column in the schema.

export const GRADES = [
  {
    code: "DS",
    label: "DS — Deadstock",
    blurb: "Never worn, all original packaging",
    // Rough share of retail this grade holds, used only when there are no
    // comps to go on. Always shown to you as an estimate, never as a comp.
    retailMultiplier: 1.0,
    restoreAdvice: "Sell as-is. Cleaning a deadstock pair only risks damaging it.",
  },
  {
    code: "VNDS",
    label: "VNDS — Very near deadstock",
    blurb: "Tried on, maybe walked indoors. No creasing",
    retailMultiplier: 0.8,
    restoreAdvice: "Sell as-is. A wipe-down at most.",
  },
  {
    code: "G9",
    label: "9/10 — Light wear",
    blurb: "Faint creasing, clean sole",
    retailMultiplier: 0.65,
    restoreAdvice: "Quick clean only. Most of the value is already there.",
  },
  {
    code: "G8",
    label: "8/10 — Worn, solid",
    blurb: "Obvious creasing, sole dirty but intact",
    retailMultiplier: 0.5,
    restoreAdvice: "A clean usually pays for itself here. Best margin lane.",
  },
  {
    code: "G7",
    label: "7/10 — Heavy wear",
    blurb: "Yellowing, scuffs, visible use",
    retailMultiplier: 0.35,
    restoreAdvice: "Full restore or pass. Half measures won't move it.",
  },
  {
    code: "G6",
    label: "6/10 and under — Beat",
    blurb: "Sole separation, holes, heel drag",
    retailMultiplier: 0.2,
    restoreAdvice: "Parts or pass, unless the model is rare enough to justify the work.",
  },
] as const;

export type GradeCode = (typeof GRADES)[number]["code"];

export const GRADE_CODES = GRADES.map((g) => g.code) as readonly GradeCode[];

export function gradeByCode(code: string) {
  return GRADES.find((g) => g.code === code);
}

export function gradeLabel(code: string) {
  return gradeByCode(code)?.label ?? code;
}

/** Grades where a restoration lane is worth quoting at all. */
export function isRestorable(code: string) {
  return code === "G8" || code === "G7" || code === "G6";
}

export const SIZE_TYPES = [
  { code: "M", label: "Men's" },
  { code: "W", label: "Women's" },
  { code: "GS", label: "Grade school" },
  { code: "PS", label: "Preschool" },
  { code: "TD", label: "Toddler" },
] as const;

export function sizeTypeLabel(code: string) {
  return SIZE_TYPES.find((s) => s.code === code)?.label ?? code;
}

/** Formats a size the way it reads on a listing: "10.5M", "7W". */
export function formatSize(size: string, sizeType: string) {
  return sizeType === "M" ? `${size}M` : `${size}${sizeType}`;
}

export const ITEM_STATUSES = [
  {
    code: "SOURCING",
    label: "Sourcing",
    blurb: "Priced but not bought yet",
    public: false,
    buyable: false,
  },
  {
    code: "IN_HAND",
    label: "In hand",
    blurb: "Owned, not listed yet",
    public: false,
    buyable: false,
  },
  {
    code: "IN_RESTORATION",
    label: "In restoration",
    blurb: "Being cleaned, painted or soled",
    public: true,
    buyable: false,
  },
  {
    code: "LISTED",
    label: "Listed",
    blurb: "For sale right now",
    public: true,
    buyable: true,
  },
  {
    code: "RESERVED",
    label: "Reserved",
    blurb: "Claimed, money pending",
    public: true,
    buyable: false,
  },
  { code: "SOLD", label: "Sold", blurb: "Gone", public: true, buyable: false },
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number]["code"];

export function statusByCode(code: string) {
  return ITEM_STATUSES.find((s) => s.code === code);
}

export function statusLabel(code: string) {
  return statusByCode(code)?.label ?? code;
}

export function isPublicStatus(code: string) {
  return statusByCode(code)?.public ?? false;
}

export function isBuyableStatus(code: string) {
  return statusByCode(code)?.buyable ?? false;
}

/** Statuses a shopper can see on the storefront. */
export const PUBLIC_STATUSES = ITEM_STATUSES.filter((s) => s.public).map(
  (s) => s.code,
);

export const ORDER_STATUSES = [
  { code: "PENDING", label: "Awaiting payment" },
  { code: "PAID", label: "Paid — needs shipping" },
  { code: "SHIPPED", label: "Shipped" },
  { code: "CANCELLED", label: "Cancelled" },
  { code: "REFUNDED", label: "Refunded" },
] as const;

export function orderStatusLabel(code: string) {
  return ORDER_STATUSES.find((s) => s.code === code)?.label ?? code;
}

export const REQUEST_STATUSES = [
  { code: "NEW", label: "New" },
  { code: "QUOTED", label: "Quoted" },
  { code: "ACCEPTED", label: "Accepted" },
  { code: "IN_PROGRESS", label: "In progress" },
  { code: "DONE", label: "Done" },
  { code: "DECLINED", label: "Declined" },
] as const;

export function requestStatusLabel(code: string) {
  return REQUEST_STATUSES.find((s) => s.code === code)?.label ?? code;
}

export const COMP_SOURCES = [
  { code: "STOCKX", label: "StockX" },
  { code: "EBAY", label: "eBay" },
  { code: "GOAT", label: "GOAT" },
  { code: "GOOGLE", label: "Google Shopping" },
  { code: "OTHER", label: "Other" },
] as const;

export function compSourceLabel(code: string) {
  return COMP_SOURCES.find((s) => s.code === code)?.label ?? code;
}

/** Default selling channels created for every new seller. */
export const DEFAULT_CHANNELS = [
  { name: "Whatnot", feeBps: 1100, fixedFeeCents: 0, isDefault: true, sortOrder: 0 },
  { name: "eBay", feeBps: 1325, fixedFeeCents: 30, isDefault: false, sortOrder: 1 },
  { name: "This site", feeBps: 320, fixedFeeCents: 30, isDefault: false, sortOrder: 2 },
  { name: "Cash in hand", feeBps: 0, fixedFeeCents: 0, isDefault: false, sortOrder: 3 },
];

// Comp research by deep link.
//
// No API keys, no scrapers, no partner applications. Each of these opens the
// search you'd have typed yourself, already filtered. eBay in particular is
// worth the trip: LH_Sold + LH_Complete gives you what pairs actually sold
// for, which is the number that matters and the one the open eBay API won't
// give you.

export interface ShoeLike {
  brand: string;
  model: string;
  colorway?: string | null;
  styleCode?: string | null;
}

export interface ResearchLink {
  source: string;
  label: string;
  url: string;
  /** Why you'd click this one rather than the others. */
  hint: string;
  /** Sold prices vs. asking prices — the difference matters when pricing. */
  kind: "SOLD" | "ASK" | "MIXED";
}

/**
 * The most precise search string available. A style code is the shoe's
 * fingerprint, so it beats brand-and-model whenever we have one.
 */
export function searchQuery(shoe: ShoeLike, opts: { size?: string } = {}): string {
  const parts = shoe.styleCode
    ? [shoe.styleCode]
    : [shoe.brand, shoe.model, shoe.colorway].filter(Boolean);
  if (opts.size) parts.push(`size ${opts.size}`);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Human-readable name for a shoe, used in headings and listing titles. */
export function shoeName(shoe: ShoeLike): string {
  return [shoe.brand, shoe.model, shoe.colorway]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function researchLinks(
  shoe: ShoeLike,
  opts: { size?: string } = {},
): ResearchLink[] {
  const broad = encodeURIComponent(searchQuery(shoe));
  const sized = encodeURIComponent(searchQuery(shoe, { size: opts.size }));

  return [
    {
      source: "EBAY",
      label: "eBay — sold prices",
      url: `https://www.ebay.com/sch/i.html?_nkw=${sized}&LH_Sold=1&LH_Complete=1&_sop=13`,
      hint: "What pairs actually sold for, newest first. Start here — this is the real number.",
      kind: "SOLD",
    },
    {
      source: "EBAY",
      label: "eBay — active listings",
      url: `https://www.ebay.com/sch/i.html?_nkw=${sized}`,
      hint: "What other sellers are asking. Runs high — don't price off this alone.",
      kind: "ASK",
    },
    {
      source: "STOCKX",
      label: "StockX",
      url: `https://stockx.com/search?s=${broad}`,
      hint: "Last sale and the bid/ask spread. Deadstock pricing, so read it as a ceiling for used.",
      kind: "MIXED",
    },
    {
      source: "GOAT",
      label: "GOAT",
      url: `https://www.goat.com/search?query=${broad}`,
      hint: "Lists used pairs by condition, which StockX mostly doesn't.",
      kind: "MIXED",
    },
    {
      source: "GOOGLE",
      label: "Google Shopping",
      url: `https://www.google.com/search?tbm=shop&q=${broad}`,
      hint: "Sweeps the smaller retailers and resale sites in one go.",
      kind: "ASK",
    },
    {
      source: "GOOGLE",
      label: "Google — everything",
      url: `https://www.google.com/search?q=${broad}+resale+price`,
      hint: "For the odd pair nothing else has. Also the fastest way to confirm a style code.",
      kind: "MIXED",
    },
  ];
}

/** Google Images, for eyeballing your pair against a known-good reference. */
export function referenceImagesLink(shoe: ShoeLike): string {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery(shoe))}`;
}

/**
 * A style code lookup. Style codes look like DH6927-111 or CT8532-104 and are
 * printed on the tongue label and the box end.
 */
export function styleCodeLink(styleCode: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(styleCode)}+sneaker`;
}

/** Loose check so the UI can nudge when a style code looks wrong. */
export function looksLikeStyleCode(value: string): boolean {
  return /^[A-Z0-9]{2,10}[- ]?[0-9]{2,4}$/i.test(value.trim());
}

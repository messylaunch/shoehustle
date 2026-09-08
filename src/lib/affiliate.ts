// Two ways someone in your network makes money on a pair. They are different
// arrangements and mixing them up is how splits end up feeling unfair, so
// they're kept separate here and named separately in the UI.
//
//   1. REFERRAL — they share their link, the customer buys at your list
//      price on your shop, you ship it, and they take a cut of the margin.
//      They never touch the money or the shoe.
//
//   2. RESELLER PRICE — they buy the pair off you at a lower price and sell
//      it however they like. Their margin is whatever they get above that.
//      They handle the customer.
//
// Both are driven by one number per person: their commission, in basis
// points. 3000 = 30%, which is the 30/70 split.

/** Gross margin on a pair before fees: what you list it at, less what you paid. */
export function marginCents(listCents: number, costCents: number): number {
  return listCents - costCents;
}

/**
 * What a referrer earns when someone buys through their link at list price.
 * Never negative — a pair sold at or below cost pays no commission rather
 * than billing the reseller for the privilege.
 */
export function referralCommissionCents(
  listCents: number,
  costCents: number,
  commissionBps: number,
): number {
  const margin = marginCents(listCents, costCents);
  if (margin <= 0) return 0;
  return Math.round((margin * commissionBps) / 10_000);
}

/**
 * The price a reseller pays for the pair, set so their margin equals the
 * commission they'd have earned by referring it. Floored at cost, so you
 * never hand out a pair below what you paid for it.
 */
export function resellerPriceCents(
  listCents: number,
  costCents: number,
  commissionBps: number,
): number {
  const cut = referralCommissionCents(listCents, costCents, commissionBps);
  return Math.max(costCents, listCents - cut);
}

/** What you keep when a referred sale goes through at list price. */
export function ownerTakeCents(
  listCents: number,
  costCents: number,
  commissionBps: number,
): number {
  return listCents - referralCommissionCents(listCents, costCents, commissionBps);
}

export interface SplitBreakdown {
  listCents: number;
  costCents: number;
  marginCents: number;
  /** Reseller's share of the margin on a referred sale. */
  commissionCents: number;
  /** What you bank on a referred sale, before fees and shipping. */
  ownerTakeCents: number;
  /** What a reseller pays if they buy it outright instead. */
  resellerPriceCents: number;
  /** Their headroom if they buy at reseller price and sell at list. */
  resellerMarginCents: number;
  commissionBps: number;
}

export function splitBreakdown(
  listCents: number,
  costCents: number,
  commissionBps: number,
): SplitBreakdown {
  const commission = referralCommissionCents(listCents, costCents, commissionBps);
  const resellerPrice = resellerPriceCents(listCents, costCents, commissionBps);
  return {
    listCents,
    costCents,
    marginCents: marginCents(listCents, costCents),
    commissionCents: commission,
    ownerTakeCents: listCents - commission,
    resellerPriceCents: resellerPrice,
    resellerMarginCents: listCents - resellerPrice,
    commissionBps,
  };
}

/**
 * Turns a handle into the form used in a referral URL. Kept strict so links
 * are safe to print on a business card and read out loud.
 */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export function isValidHandle(handle: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,29}$/.test(handle);
}

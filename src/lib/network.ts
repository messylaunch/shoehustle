// Who gets paid what on a sale.
//
// One rule holds the whole thing together: everybody is paid out of the
// MARGIN, never out of the cost. Whoever bought and restored the pair gets
// their money back off the top, and only what's left over gets split. Break
// that rule and the person funding the inventory goes broke while everyone
// else feels well paid.
//
// Three parts on any sale, and one person can play more than one:
//
//   OWNER   sourced it, paid for it, restored it. Carries the money risk.
//   HOLDER  physically has it in their city and hands it over at the meet.
//   SELLER  found the buyer.

export interface SplitInput {
  /** What the buyer pays for the pair, excluding shipping. */
  listCents: number;
  /** All-in cost to the owner: the shoe, plus supplies and consumables. */
  costCents: number;
  /**
   * Card processing on this sale. Real money that leaves before anybody is
   * paid, so it has to come out before the split — otherwise the app happily
   * reports a losing deal as healthy.
   */
  feeCents?: number;
  /** Postage and packaging. Zero on a pickup, which is why pickup pays more. */
  shipCents?: number;
  /** Seller's share of the margin, in basis points. 3000 = 30%. */
  sellerBps: number;
  /** Holder's share of the margin, in basis points. */
  holderBps: number;
}

export interface Split {
  marginCents: number;
  sellerCents: number;
  holderCents: number;
  ownerCents: number;
  /** Owner's take as a share of margin, for sanity-checking a deal. */
  ownerBps: number;
  /** True when the splits were scaled down to fit what's actually there. */
  clamped: boolean;
}

/**
 * Margin is what's actually left to share: the sale price, less the shoe,
 * less the card fee, less postage. Everything that leaves before anybody is
 * paid has to come out here — split `list - cost` and the app will cheerfully
 * report a losing sale as a healthy one.
 */
export function marginCents(
  listCents: number,
  costCents: number,
  feeCents = 0,
  shipCents = 0,
): number {
  return Math.max(0, listCents - costCents - feeCents - shipCents);
}

/**
 * Splits a sale three ways.
 *
 * If the configured shares add up to more than the whole margin, they're
 * scaled down proportionally rather than paying out money that doesn't
 * exist — and the result says so, so the UI can warn instead of quietly
 * short-changing someone.
 */
export function splitSale(input: SplitInput): Split {
  const margin = marginCents(
    input.listCents,
    input.costCents,
    input.feeCents ?? 0,
    input.shipCents ?? 0,
  );

  const sellerBps = Math.max(0, input.sellerBps);
  const holderBps = Math.max(0, input.holderBps);
  const totalBps = sellerBps + holderBps;

  if (margin === 0 || totalBps === 0) {
    return {
      marginCents: margin,
      sellerCents: 0,
      holderCents: 0,
      ownerCents: margin,
      ownerBps: 10_000,
      clamped: false,
    };
  }

  const clamped = totalBps > 10_000;
  const scale = clamped ? 10_000 / totalBps : 1;

  const sellerCents = Math.round((margin * sellerBps * scale) / 10_000);
  const holderCents = Math.round((margin * holderBps * scale) / 10_000);
  // Owner absorbs the rounding so the three parts always sum to the margin.
  const ownerCents = margin - sellerCents - holderCents;

  return {
    marginCents: margin,
    sellerCents,
    holderCents,
    ownerCents,
    ownerBps: Math.round((ownerCents / margin) * 10_000),
    clamped,
  };
}

/**
 * What one person takes home when they're both holder and seller — the
 * normal case in a small city, where one person runs the whole territory.
 */
export function soloTakeCents(input: SplitInput): number {
  const split = splitSale(input);
  return split.sellerCents + split.holderCents;
}

export type DealVerdict = "healthy" | "thin" | "upside-down";

export interface DealCheck {
  verdict: DealVerdict;
  headline: string;
  detail: string;
}

/**
 * Sanity-checks a proposed split before you promise it to somebody.
 * The failure this catches is agreeing to a percentage that sounds generous
 * in conversation and leaves the person funding the stock with nothing.
 */
export function checkDeal(input: SplitInput): DealCheck {
  const split = splitSale(input);

  if (split.marginCents === 0) {
    return {
      verdict: "upside-down",
      headline: "There's nothing to split",
      detail:
        "This pair doesn't sell for more than it cost. Reprice it or don't list it.",
    };
  }

  if (split.clamped) {
    return {
      verdict: "upside-down",
      headline: "You've promised more than 100% of the margin",
      detail:
        "The shares have been scaled down to fit. Lower somebody's percentage before this sale happens for real.",
    };
  }

  // A holder stores your stock in their home and gives up a fixed slot every
  // week whether or not anyone turns up. Pennies a pair is how they quit in
  // month two and keep the shoes.
  if (input.holderBps > 0 && split.holderCents < MIN_HOLDER_CENTS) {
    return {
      verdict: "thin",
      headline: "The holder is working for pennies",
      detail: `Whoever stores this pair and stands in a lot to hand it over earns ${(split.holderCents / 100).toFixed(2)} on it. They have fixed hours and your inventory in their house — under about $${(MIN_HOLDER_CENTS / 100).toFixed(0)} a pair, nobody does that twice.`,
    };
  }

  // Below about a third of the margin, the person carrying the money risk is
  // earning less than the people who carry none.
  if (split.ownerBps < 3500) {
    return {
      verdict: "thin",
      headline: "The owner is carrying the risk for very little",
      detail: `Whoever paid for and restored this pair keeps ${(split.ownerBps / 100).toFixed(0)}% of the margin. They fund the stock — if they aren't the best-paid part of this deal, the inventory stops.`,
    };
  }

  return {
    verdict: "healthy",
    headline: "This split works",
    detail: `Owner keeps ${(split.ownerBps / 100).toFixed(0)}% of the margin and gets their cost back first.`,
  };
}

/**
 * The least a handover can pay before the role stops being worth doing.
 * A meet costs someone roughly four hours a week all in; at three handovers
 * that has to clear something recognisable as a wage.
 */
export const MIN_HOLDER_CENTS = 500;

/**
 * Translates "they get 70%" into what it means against each base, because
 * the same sentence means three wildly different deals depending on what
 * you're taking a percentage OF.
 */
export interface SeventyThirtyReading {
  base: string;
  theyGet: number;
  youGet: number;
  works: boolean;
  note: string;
}

export function readSeventyThirty(
  listCents: number,
  costCents: number,
  theirBps = 7000,
  feeCents = 0,
  shipCents = 0,
): SeventyThirtyReading[] {
  const margin = marginCents(listCents, costCents, feeCents, shipCents);
  const pct = theirBps / 10_000;

  const ofRevenue = Math.round(listCents * pct);
  const ofMargin = Math.round(margin * pct);

  return [
    {
      base: "of the sale price",
      theyGet: ofRevenue,
      youGet: listCents - ofRevenue,
      // What's left has to cover the shoe, the card fee and the postage.
      works: listCents - ofRevenue >= costCents + feeCents + shipCents,
      note: "You still have to cover the shoe, the card fee and postage out of what's left.",
    },
    {
      base: "of the margin",
      theyGet: ofMargin,
      youGet: margin - ofMargin,
      works: true,
      note: "You get your cost back first, then split what's above it.",
    },
  ];
}

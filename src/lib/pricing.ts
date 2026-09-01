// The buy calculator.
//
// Nothing in here talks to a network or a database. It is the arithmetic you'd
// otherwise do in your head at 11pm in a live room with forty seconds to bid:
//
//   max buy = (sell x (1 - fee)) - fixed fee - shipping - recondition - profit
//
// Every value in and out is integer cents.

import { GRADES, gradeByCode, isRestorable } from "./constants";

export interface FeeProfile {
  /** Platform commission in basis points. 1100 = 11%. */
  feeBps: number;
  /** Per-sale flat fee, e.g. eBay's $0.30 order fee. */
  fixedFeeCents: number;
}

export interface CostProfile {
  /** What it costs you to ship the pair out. */
  shipOutCents: number;
  /** Supplies and time for this lane's work. Zero for the as-is lane. */
  reconditionCents: number;
  /** What you want to clear on the pair. */
  targetProfitCents: number;
}

/**
 * What actually lands in your pocket from a sale, before your own costs.
 * Never returns less than zero — a fee larger than the sale price means you
 * net nothing, not a negative payout.
 */
export function netProceedsCents(sellCents: number, fee: FeeProfile): number {
  if (sellCents <= 0) return 0;
  const commission = Math.round((sellCents * fee.feeBps) / 10_000);
  return Math.max(0, sellCents - commission - fee.fixedFeeCents);
}

/**
 * The most you can pay for a pair and still clear your target profit.
 * Can legitimately come back negative: that means the deal doesn't work at
 * any price, which is exactly what you want the app to tell you.
 */
export function maxBuyCents(
  sellCents: number,
  fee: FeeProfile,
  costs: CostProfile,
): number {
  return (
    netProceedsCents(sellCents, fee) -
    costs.shipOutCents -
    costs.reconditionCents -
    costs.targetProfitCents
  );
}

/** What you'd actually clear if you bought at `buyCents` and sold at `sellCents`. */
export function profitCents(
  sellCents: number,
  buyCents: number,
  fee: FeeProfile,
  costs: Omit<CostProfile, "targetProfitCents">,
): number {
  return (
    netProceedsCents(sellCents, fee) -
    costs.shipOutCents -
    costs.reconditionCents -
    buyCents
  );
}

/**
 * Return on what you put in, as a percentage. Null when you have nothing at
 * risk — infinite ROI on a free pair is a true but useless number.
 */
export function roiPercent(
  sellCents: number,
  buyCents: number,
  fee: FeeProfile,
  costs: Omit<CostProfile, "targetProfitCents">,
): number | null {
  const invested = buyCents + costs.reconditionCents + costs.shipOutCents;
  if (invested <= 0) return null;
  return (profitCents(sellCents, buyCents, fee, costs) / invested) * 100;
}

// ---------------------------------------------------------------------------
// Comps
// ---------------------------------------------------------------------------

export interface CompLike {
  priceCents: number;
  kind: string; // SOLD | ASK
  grade?: string | null;
  size?: string | null;
}

/** Asks run high. Discount them before mixing them with real sales. */
export const ASK_DISCOUNT = 0.85;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export type EstimateBasis =
  | "sold-at-grade"
  | "sold-any-grade"
  | "asks-discounted"
  | "retail-multiplier"
  | "none";

export interface Estimate {
  cents: number | null;
  basis: EstimateBasis;
  /** How many comps went into it. */
  sampleSize: number;
  /** Plain-language note for the UI, so no number is shown without its source. */
  note: string;
}

/**
 * Estimates what a pair sells for at a given grade.
 *
 * Prefers real sales at the same grade, because a blended average across all
 * conditions is how you talk yourself into a bad buy. Falls back down a ladder
 * and always reports which rung it landed on.
 */
export function estimateSellPrice(
  comps: CompLike[],
  grade: string,
  retailCents?: number | null,
): Estimate {
  const sold = comps.filter((c) => c.kind === "SOLD");
  const asks = comps.filter((c) => c.kind === "ASK");

  const soldAtGrade = sold.filter((c) => c.grade === grade);
  if (soldAtGrade.length > 0) {
    return {
      cents: median(soldAtGrade.map((c) => c.priceCents)),
      basis: "sold-at-grade",
      sampleSize: soldAtGrade.length,
      note: `Median of ${soldAtGrade.length} sold ${soldAtGrade.length === 1 ? "comp" : "comps"} at this grade.`,
    };
  }

  if (sold.length > 0) {
    // No sales at this exact grade, so scale a blended sold figure by how this
    // grade relates to the average grade we do have.
    const blended = median(sold.map((c) => c.priceCents));
    const scaled = blended === null ? null : scaleAcrossGrades(blended, sold, grade);
    return {
      cents: scaled,
      basis: "sold-any-grade",
      sampleSize: sold.length,
      note: `No sold comps at this grade. Scaled from ${sold.length} sold ${sold.length === 1 ? "comp" : "comps"} at other grades — treat as rough.`,
    };
  }

  if (asks.length > 0) {
    const asking = median(asks.map((c) => c.priceCents));
    return {
      cents: asking === null ? null : Math.round(asking * ASK_DISCOUNT),
      basis: "asks-discounted",
      sampleSize: asks.length,
      note: `No sold comps yet. Based on ${asks.length} asking ${asks.length === 1 ? "price" : "prices"}, discounted ${Math.round((1 - ASK_DISCOUNT) * 100)}% — asks are what sellers hope for, not what pairs go for.`,
    };
  }

  if (retailCents && retailCents > 0) {
    const multiplier = gradeByCode(grade)?.retailMultiplier;
    if (multiplier !== undefined) {
      return {
        cents: Math.round(retailCents * multiplier),
        basis: "retail-multiplier",
        sampleSize: 0,
        note: `No comps at all. This is retail times a rule-of-thumb for ${grade}. Look up two real comps before you bid on this.`,
      };
    }
  }

  return {
    cents: null,
    basis: "none",
    sampleSize: 0,
    note: "No comps and no retail price. Add a comp below to get an estimate.",
  };
}

/**
 * Adjusts a blended sold figure toward a target grade using the retail
 * multipliers as a shape. Deliberately conservative: it moves the number, it
 * doesn't pretend to know the market.
 */
function scaleAcrossGrades(
  blendedCents: number,
  sold: CompLike[],
  targetGrade: string,
): number {
  const targetMultiplier = gradeByCode(targetGrade)?.retailMultiplier;
  if (targetMultiplier === undefined) return blendedCents;

  const known: number[] = [];
  for (const comp of sold) {
    const multiplier = comp.grade
      ? gradeByCode(comp.grade)?.retailMultiplier
      : undefined;
    if (multiplier !== undefined) known.push(multiplier);
  }

  if (known.length === 0) return blendedCents;

  const avg = known.reduce((sum, m) => sum + m, 0) / known.length;
  if (avg <= 0) return blendedCents;

  return Math.round(blendedCents * (targetMultiplier / avg));
}

// ---------------------------------------------------------------------------
// The three lanes
// ---------------------------------------------------------------------------

export type LaneKey = "asIs" | "clean" | "restored";

export interface Lane {
  key: LaneKey;
  label: string;
  /** What you'd list it for in this lane. */
  sellCents: number | null;
  /** Work cost for this lane. */
  reconditionCents: number;
  /** What you can pay and still hit target profit. */
  maxBuyCents: number | null;
  netProceedsCents: number | null;
  /** True when this lane doesn't apply — e.g. restoring a deadstock pair. */
  notApplicable: boolean;
  note: string;
}

export interface LaneInputs {
  /** Estimated as-is sale price at the pair's current grade. */
  asIsCents: number | null;
  /** Estimated price after a clean, if known. */
  cleanCents?: number | null;
  /** Estimated price after a full restore, if known. */
  restoredCents?: number | null;
  grade: string;
  fee: FeeProfile;
  shipOutCents: number;
  cleanCostCents: number;
  restoreCostCents: number;
  targetProfitCents: number;
}

/**
 * How much a clean lifts a pair when you have no restored comps to go on.
 * A clean moves a pair roughly one grade up; a full restore, two.
 */
export function liftedEstimate(
  asIsCents: number,
  grade: string,
  steps: number,
): number | null {
  const index = GRADES.findIndex((g) => g.code === grade);
  if (index === -1) return null;
  const target = GRADES[Math.max(0, index - steps)];
  const current = GRADES[index];
  if (!target || current.retailMultiplier <= 0) return null;
  return Math.round(asIsCents * (target.retailMultiplier / current.retailMultiplier));
}

export function buildLanes(input: LaneInputs): Lane[] {
  const {
    asIsCents,
    grade,
    fee,
    shipOutCents,
    cleanCostCents,
    restoreCostCents,
    targetProfitCents,
  } = input;

  const restorable = isRestorable(grade);

  const cleanSell =
    input.cleanCents ??
    (asIsCents !== null ? liftedEstimate(asIsCents, grade, 1) : null);
  const restoredSell =
    input.restoredCents ??
    (asIsCents !== null ? liftedEstimate(asIsCents, grade, 2) : null);

  const lane = (
    key: LaneKey,
    label: string,
    sellCents: number | null,
    reconditionCents: number,
    notApplicable: boolean,
    note: string,
  ): Lane => ({
    key,
    label,
    sellCents: notApplicable ? null : sellCents,
    reconditionCents,
    netProceedsCents:
      notApplicable || sellCents === null ? null : netProceedsCents(sellCents, fee),
    maxBuyCents:
      notApplicable || sellCents === null
        ? null
        : maxBuyCents(sellCents, fee, {
            shipOutCents,
            reconditionCents,
            targetProfitCents,
          }),
    notApplicable,
    note,
  });

  return [
    lane(
      "asIs",
      "Sell as-is",
      asIsCents,
      0,
      false,
      "List it the way it sits. No work, no supplies.",
    ),
    lane(
      "clean",
      "Clean it up",
      cleanSell,
      cleanCostCents,
      !restorable && grade !== "G9",
      restorable || grade === "G9"
        ? "Wash, laces, sole scrub. The lane that usually pays best."
        : "Already clean — nothing to gain here.",
    ),
    lane(
      "restored",
      "Full restore",
      restoredSell,
      restoreCostCents,
      !restorable,
      restorable
        ? "Paint, sole work, deep clean. More money, more of your time."
        : "Too clean to restore. You'd be spending money for nothing.",
    ),
  ];
}

/** The lane with the highest max buy — the one to bid against. */
export function bestLane(lanes: Lane[]): Lane | null {
  const viable = lanes.filter(
    (l) => !l.notApplicable && l.maxBuyCents !== null,
  );
  if (viable.length === 0) return null;
  return viable.reduce((best, l) =>
    (l.maxBuyCents as number) > (best.maxBuyCents as number) ? l : best,
  );
}

/**
 * The verdict on a price you're being asked to pay.
 * `walk` is the one that matters — it's the app telling you to stop bidding.
 */
export interface Verdict {
  kind: "buy" | "thin" | "walk" | "unknown";
  headline: string;
  detail: string;
  /** Cents of headroom between the ask and your ceiling. Negative means over. */
  headroomCents: number | null;
}

export function verdictFor(
  askCents: number | null,
  lanes: Lane[],
): Verdict {
  const best = bestLane(lanes);
  if (best === null || best.maxBuyCents === null) {
    return {
      kind: "unknown",
      headline: "Not enough to go on",
      detail: "Add a comp or a retail price and the ceiling will fill in.",
      headroomCents: null,
    };
  }
  const ceiling = best.maxBuyCents;

  if (askCents === null) {
    return {
      kind: "unknown",
      headline: `Ceiling is ${(ceiling / 100).toFixed(2)}`,
      detail: `Best lane: ${best.label}.`,
      headroomCents: null,
    };
  }

  const headroom = ceiling - askCents;

  if (ceiling <= 0) {
    return {
      kind: "walk",
      headline: "Walk away",
      detail:
        "There's no price that works here. Fees, shipping and your target profit eat the whole sale.",
      headroomCents: headroom,
    };
  }
  if (headroom < 0) {
    return {
      kind: "walk",
      headline: "Stop bidding",
      detail: `You're ${((headroom * -1) / 100).toFixed(2)} over your ceiling on the ${best.label.toLowerCase()} lane.`,
      headroomCents: headroom,
    };
  }
  // Under ten percent of the ceiling left is one bad surprise from a loss.
  if (headroom < ceiling * 0.1) {
    return {
      kind: "thin",
      headline: "Thin — your call",
      detail: `Only ${(headroom / 100).toFixed(2)} of room left. One thing goes wrong and you're working for free.`,
      headroomCents: headroom,
    };
  }
  return {
    kind: "buy",
    headline: "Good buy",
    detail: `${(headroom / 100).toFixed(2)} under your ceiling on the ${best.label.toLowerCase()} lane.`,
    headroomCents: headroom,
  };
}

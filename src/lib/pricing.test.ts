import { describe, expect, it } from "vitest";
import {
  bestLane,
  buildLanes,
  estimateSellPrice,
  liftedEstimate,
  maxBuyCents,
  median,
  netProceedsCents,
  profitCents,
  roiPercent,
  verdictFor,
  type CompLike,
  type FeeProfile,
} from "./pricing";

const whatnot: FeeProfile = { feeBps: 1100, fixedFeeCents: 0 };
const ebay: FeeProfile = { feeBps: 1325, fixedFeeCents: 30 };
const cash: FeeProfile = { feeBps: 0, fixedFeeCents: 0 };

describe("netProceedsCents", () => {
  it("takes commission off the sale price", () => {
    // $65 at 11% -> $65 - $7.15
    expect(netProceedsCents(6500, whatnot)).toBe(5785);
  });

  it("takes the flat fee as well", () => {
    // $65 at 13.25% -> $65 - $8.61 - $0.30
    expect(netProceedsCents(6500, ebay)).toBe(6500 - 861 - 30);
  });

  it("passes the whole sale through when there are no fees", () => {
    expect(netProceedsCents(6500, cash)).toBe(6500);
  });

  it("never returns a negative payout", () => {
    expect(netProceedsCents(10, { feeBps: 0, fixedFeeCents: 500 })).toBe(0);
  });

  it("returns zero for a worthless sale", () => {
    expect(netProceedsCents(0, whatnot)).toBe(0);
    expect(netProceedsCents(-100, whatnot)).toBe(0);
  });
});

describe("maxBuyCents", () => {
  // The worked example from the product draft: a pair worth $95 restored,
  // sold on a channel taking 11%, $12 to ship, $18 of restoration, wanting
  // $30 of profit. Comes out at $24.55 — so $23 is a buy and $30 is not.
  it("matches the worked example", () => {
    expect(
      maxBuyCents(9500, whatnot, {
        shipOutCents: 1200,
        reconditionCents: 1800,
        targetProfitCents: 3000,
      }),
    ).toBe(2455);
  });

  it("goes negative when the deal cannot work at any price", () => {
    expect(
      maxBuyCents(2000, whatnot, {
        shipOutCents: 1200,
        reconditionCents: 1800,
        targetProfitCents: 3000,
      }),
    ).toBeLessThan(0);
  });

  it("gives more room on a cheaper channel", () => {
    const costs = {
      shipOutCents: 1200,
      reconditionCents: 1800,
      targetProfitCents: 3000,
    };
    expect(maxBuyCents(9500, cash, costs)).toBeGreaterThan(
      maxBuyCents(9500, whatnot, costs),
    );
  });
});

describe("profitCents and roiPercent", () => {
  const costs = { shipOutCents: 1200, reconditionCents: 1800 };

  it("clears the target when bought at the ceiling", () => {
    // Buying at exactly the max buy price should leave the target profit.
    const ceiling = maxBuyCents(9500, whatnot, {
      ...costs,
      targetProfitCents: 3000,
    });
    expect(profitCents(9500, ceiling, whatnot, costs)).toBe(3000);
  });

  it("computes profit on the real example", () => {
    // Bought at $23, sold restored at $95.
    expect(profitCents(9500, 2300, whatnot, costs)).toBe(3155);
  });

  it("reports a loss as a negative number", () => {
    expect(profitCents(4000, 3000, whatnot, costs)).toBeLessThan(0);
  });

  it("computes ROI against everything you put in", () => {
    // $23 buy + $18 restore + $12 ship = $53 in, $31.55 out.
    const roi = roiPercent(9500, 2300, whatnot, costs);
    expect(roi).toBeCloseTo((3155 / 5300) * 100, 5);
  });

  it("returns null when nothing is at risk", () => {
    expect(
      roiPercent(9500, 0, whatnot, { shipOutCents: 0, reconditionCents: 0 }),
    ).toBeNull();
  });
});

describe("median", () => {
  it("returns null for no values", () => {
    expect(median([])).toBeNull();
  });

  it("handles an odd count", () => {
    expect(median([300, 100, 200])).toBe(200);
  });

  it("averages the middle two on an even count", () => {
    expect(median([100, 200, 300, 400])).toBe(250);
  });

  it("does not mutate the input", () => {
    const values = [300, 100, 200];
    median(values);
    expect(values).toEqual([300, 100, 200]);
  });
});

describe("estimateSellPrice", () => {
  it("prefers sold comps at the same grade", () => {
    const comps: CompLike[] = [
      { priceCents: 6000, kind: "SOLD", grade: "G8" },
      { priceCents: 7000, kind: "SOLD", grade: "G8" },
      { priceCents: 12000, kind: "SOLD", grade: "DS" },
      { priceCents: 20000, kind: "ASK", grade: "G8" },
    ];
    const est = estimateSellPrice(comps, "G8");
    expect(est.basis).toBe("sold-at-grade");
    expect(est.cents).toBe(6500);
    expect(est.sampleSize).toBe(2);
  });

  it("scales from other grades when none match", () => {
    const comps: CompLike[] = [{ priceCents: 12000, kind: "SOLD", grade: "DS" }];
    const est = estimateSellPrice(comps, "G8");
    expect(est.basis).toBe("sold-any-grade");
    // DS multiplier 1.0 -> G8 multiplier 0.5, so half of $120.
    expect(est.cents).toBe(6000);
  });

  it("discounts asking prices and says so", () => {
    const comps: CompLike[] = [
      { priceCents: 10000, kind: "ASK", grade: "G8" },
      { priceCents: 12000, kind: "ASK", grade: "G8" },
    ];
    const est = estimateSellPrice(comps, "G8");
    expect(est.basis).toBe("asks-discounted");
    expect(est.cents).toBe(9350); // median 11000 * 0.85
    expect(est.note).toMatch(/asks are what sellers hope for/i);
  });

  it("falls back to retail times a grade multiplier", () => {
    const est = estimateSellPrice([], "G8", 12000);
    expect(est.basis).toBe("retail-multiplier");
    expect(est.cents).toBe(6000);
    expect(est.sampleSize).toBe(0);
  });

  it("gives up honestly with nothing to go on", () => {
    const est = estimateSellPrice([], "G8");
    expect(est.basis).toBe("none");
    expect(est.cents).toBeNull();
  });
});

describe("liftedEstimate", () => {
  it("moves a pair up one grade for a clean", () => {
    // G8 (0.5) -> G9 (0.65): $60 becomes $78.
    expect(liftedEstimate(6000, "G8", 1)).toBe(7800);
  });

  it("moves two grades for a full restore", () => {
    // G8 (0.5) -> VNDS (0.8): $60 becomes $96.
    expect(liftedEstimate(6000, "G8", 2)).toBe(9600);
  });

  it("stops at the top of the scale", () => {
    expect(liftedEstimate(6000, "DS", 2)).toBe(6000);
  });

  it("returns null for an unknown grade", () => {
    expect(liftedEstimate(6000, "NOPE", 1)).toBeNull();
  });
});

describe("buildLanes", () => {
  const base = {
    grade: "G8",
    fee: whatnot,
    shipOutCents: 1200,
    cleanCostCents: 800,
    restoreCostCents: 1800,
    targetProfitCents: 3000,
  };

  it("prices all three lanes for a restorable pair", () => {
    const lanes = buildLanes({ ...base, asIsCents: 6500, restoredCents: 9500 });
    expect(lanes).toHaveLength(3);
    expect(lanes.every((l) => !l.notApplicable)).toBe(true);

    const restored = lanes.find((l) => l.key === "restored");
    expect(restored?.sellCents).toBe(9500);
    expect(restored?.maxBuyCents).toBe(2455);
  });

  it("marks restoration not applicable on a deadstock pair", () => {
    const lanes = buildLanes({ ...base, grade: "DS", asIsCents: 12000 });
    const restored = lanes.find((l) => l.key === "restored");
    expect(restored?.notApplicable).toBe(true);
    expect(restored?.maxBuyCents).toBeNull();
    expect(restored?.note).toMatch(/too clean to restore/i);
  });

  it("derives clean and restored prices when not supplied", () => {
    const lanes = buildLanes({ ...base, asIsCents: 6000 });
    expect(lanes.find((l) => l.key === "clean")?.sellCents).toBe(7800);
    expect(lanes.find((l) => l.key === "restored")?.sellCents).toBe(9600);
  });

  it("leaves every lane empty when there is no estimate", () => {
    const lanes = buildLanes({ ...base, asIsCents: null });
    expect(lanes.every((l) => l.maxBuyCents === null)).toBe(true);
  });
});

describe("bestLane", () => {
  const base = {
    grade: "G8",
    fee: whatnot,
    shipOutCents: 1200,
    cleanCostCents: 800,
    restoreCostCents: 1800,
    targetProfitCents: 3000,
  };

  it("picks the lane with the most room to bid", () => {
    const lanes = buildLanes({ ...base, asIsCents: 6500, restoredCents: 9500 });
    const best = bestLane(lanes);
    // Clean sells for $84.50 on $8 of work -> $25.20 ceiling.
    // Restore sells for $95.00 on $18 of work -> $24.55 ceiling.
    // The extra $10.50 of revenue doesn't cover $10 more work plus the fee on
    // it, so cleaning wins by 65 cents. This is the calculator earning its
    // keep: the obvious lane is not always the right one.
    expect(best?.key).toBe("clean");
    expect(best?.maxBuyCents).toBe(2520);
  });

  it("switches to the restore lane when restoring lifts the price enough", () => {
    // Same pair, but restored comps come back at $130 instead of $95.
    const lanes = buildLanes({ ...base, asIsCents: 6500, restoredCents: 13000 });
    expect(bestLane(lanes)?.key).toBe("restored");
  });

  it("returns null when nothing is priceable", () => {
    expect(bestLane(buildLanes({ ...base, asIsCents: null }))).toBeNull();
  });
});

describe("verdictFor", () => {
  const base = {
    grade: "G8",
    fee: whatnot,
    shipOutCents: 1200,
    cleanCostCents: 800,
    restoreCostCents: 1800,
    targetProfitCents: 3000,
  };
  const lanes = buildLanes({ ...base, asIsCents: 6500, restoredCents: 9500 });

  // Best lane on this pair is the clean lane, ceiling $25.20.
  it("calls $23 thin — in, but barely", () => {
    const verdict = verdictFor(2300, lanes);
    expect(verdict.kind).toBe("thin");
    expect(verdict.headroomCents).toBe(220);
    expect(verdict.detail).toMatch(/working for free/i);
  });

  it("calls a genuinely cheap pair a clear buy", () => {
    const verdict = verdictFor(1500, lanes);
    expect(verdict.kind).toBe("buy");
    expect(verdict.headroomCents).toBe(1020);
  });

  it("tells you to stop bidding at $30", () => {
    const verdict = verdictFor(3000, lanes);
    expect(verdict.kind).toBe("walk");
    expect(verdict.headline).toBe("Stop bidding");
    expect(verdict.headroomCents).toBe(-480);
  });

  it("flags a price that is technically under but leaves no room", () => {
    // $25.00 against a $25.20 ceiling: twenty cents of headroom.
    const verdict = verdictFor(2500, lanes);
    expect(verdict.kind).toBe("thin");
  });

  it("walks away when no price works at all", () => {
    const deadLanes = buildLanes({ ...base, asIsCents: 1000 });
    const verdict = verdictFor(500, deadLanes);
    expect(verdict.kind).toBe("walk");
    expect(verdict.detail).toMatch(/no price that works/i);
  });

  it("says so when there is nothing to price against", () => {
    expect(verdictFor(2300, buildLanes({ ...base, asIsCents: null })).kind).toBe(
      "unknown",
    );
  });
});

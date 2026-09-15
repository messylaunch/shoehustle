import { describe, expect, it } from "vitest";
import {
  checkDeal,
  marginCents,
  readSeventyThirty,
  soloTakeCents,
  splitSale,
} from "./network";

// The running example: a pair costing $28 all-in, listed at $65.
const base = { listCents: 6500, costCents: 2800, sellerBps: 3000, holderBps: 1500 };

describe("marginCents", () => {
  it("is what's left after the owner is made whole", () => {
    expect(marginCents(6500, 2800)).toBe(3700);
  });

  it("takes the card fee and postage out before anyone is paid", () => {
    // $55 shipped: $1.90 card, $11 postage on a $28 pair leaves $14.10.
    expect(marginCents(5500, 2800, 190, 1100)).toBe(1410);
  });

  it("is much bigger on a pickup, because postage is zero", () => {
    expect(marginCents(5500, 2800, 190, 0)).toBe(2510);
  });

  it("never goes negative", () => {
    // A pair sold below cost has nothing to share, not a debt to share out.
    expect(marginCents(2000, 2800)).toBe(0);
    expect(marginCents(3000, 2800, 190, 1100)).toBe(0);
  });
});

describe("splitSale", () => {
  it("pays seller and holder out of the margin, owner keeps the rest", () => {
    const split = splitSale(base);
    expect(split.marginCents).toBe(3700);
    expect(split.sellerCents).toBe(1110); // 30% of $37
    expect(split.holderCents).toBe(555); // 15% of $37
    expect(split.ownerCents).toBe(2035);
  });

  it("always sums back to the margin", () => {
    for (const listCents of [4000, 6500, 9999, 12345]) {
      const split = splitSale({ ...base, listCents });
      expect(split.sellerCents + split.holderCents + split.ownerCents).toBe(
        split.marginCents,
      );
    }
  });

  it("gives everything to the owner when nobody else is involved", () => {
    const split = splitSale({ ...base, sellerBps: 0, holderBps: 0 });
    expect(split.ownerCents).toBe(3700);
    expect(split.ownerBps).toBe(10_000);
  });

  it("has nothing to split on a pair that sells at cost", () => {
    const split = splitSale({ ...base, listCents: 2800 });
    expect(split.marginCents).toBe(0);
    expect(split.sellerCents).toBe(0);
    expect(split.ownerCents).toBe(0);
  });

  it("scales shares down rather than paying out money that isn't there", () => {
    // 70% + 50% = 120% of the margin.
    const split = splitSale({ ...base, sellerBps: 7000, holderBps: 5000 });
    expect(split.clamped).toBe(true);
    expect(split.sellerCents + split.holderCents).toBeLessThanOrEqual(
      split.marginCents,
    );
    expect(split.ownerCents).toBeGreaterThanOrEqual(0);
  });
});

describe("soloTakeCents", () => {
  it("pays both parts when one person does both jobs", () => {
    // The normal case in a small city: 30% + 15% of $37.
    expect(soloTakeCents(base)).toBe(1665);
  });
});

describe("splitSale with real costs", () => {
  // The failure this guards against: splitting list-minus-cost on a shipped
  // sale pays out more than the sale actually produced.
  it("does not pay out more than a shipped sale really made", () => {
    const shipped = splitSale({
      listCents: 5500,
      costCents: 2800,
      feeCents: 190,
      shipCents: 1100,
      sellerBps: 3000,
      holderBps: 1500,
    });
    // Real cash margin on that sale is $14.10, not $27.
    expect(shipped.marginCents).toBe(1410);
    expect(shipped.sellerCents + shipped.holderCents).toBeLessThanOrEqual(1410);
    expect(shipped.ownerCents).toBeGreaterThanOrEqual(0);
  });

  it("leaves the owner far better off on a pickup than a shipped sale", () => {
    const common = {
      listCents: 5500,
      costCents: 2800,
      feeCents: 190,
      sellerBps: 3000,
      holderBps: 1500,
    };
    const pickup = splitSale({ ...common, shipCents: 0 });
    const shipped = splitSale({ ...common, shipCents: 1100 });
    expect(pickup.ownerCents - shipped.ownerCents).toBe(605);
  });
});

describe("checkDeal", () => {
  it("passes a split where the owner is still best paid", () => {
    const check = checkDeal(base);
    expect(check.verdict).toBe("healthy");
    expect(check.detail).toMatch(/55%/);
  });

  it("refuses a holder cut nobody would get out of bed for", () => {
    // 1% of a $37 margin is 37 cents to store stock and work a weekly slot.
    const check = checkDeal({ ...base, holderBps: 100 });
    expect(check.verdict).toBe("thin");
    expect(check.headline).toMatch(/pennies/i);
  });

  it("says nothing about the holder when there isn't one", () => {
    const check = checkDeal({ ...base, holderBps: 0 });
    expect(check.verdict).toBe("healthy");
  });

  it("catches a shipped sale that looks fine but isn't", () => {
    // Splitting list-minus-cost here would report healthy; with the real
    // costs in, there's barely anything to share.
    const check = checkDeal({
      listCents: 5500,
      costCents: 2800,
      feeCents: 190,
      shipCents: 1100,
      sellerBps: 3000,
      holderBps: 1500,
    });
    expect(check.verdict).toBe("thin");
  });

  it("warns when the owner carries the risk for very little", () => {
    // Seller 50%, holder 25% leaves the owner 25%.
    const check = checkDeal({ ...base, sellerBps: 5000, holderBps: 2500 });
    expect(check.verdict).toBe("thin");
    expect(check.detail).toMatch(/fund the stock/i);
  });

  it("refuses a split that promises more than the whole margin", () => {
    const check = checkDeal({ ...base, sellerBps: 7000, holderBps: 5000 });
    expect(check.verdict).toBe("upside-down");
    expect(check.headline).toMatch(/more than 100%/i);
  });

  it("refuses a pair with no margin at all", () => {
    const check = checkDeal({ ...base, listCents: 2500 });
    expect(check.verdict).toBe("upside-down");
    expect(check.detail).toMatch(/reprice/i);
  });
});

describe("readSeventyThirty", () => {
  // The whole point: "they get 70%" is three different deals depending on
  // what the 70% is taken from.
  const readings = readSeventyThirty(6500, 2800);

  it("shows 70% of the sale price does not cover the cost of the shoe", () => {
    const ofRevenue = readings.find((r) => r.base === "of the sale price");
    expect(ofRevenue?.theyGet).toBe(4550);
    expect(ofRevenue?.youGet).toBe(1950);
    // $19.50 left against a $28 shoe — you'd lose $8.50 on every sale.
    expect(ofRevenue?.works).toBe(false);
  });

  it("shows 70% of the margin is a real deal that works", () => {
    const ofMargin = readings.find((r) => r.base === "of the margin");
    expect(ofMargin?.theyGet).toBe(2590);
    expect(ofMargin?.youGet).toBe(1110);
    expect(ofMargin?.works).toBe(true);
  });

  it("handles a split where any base works", () => {
    // A pair costing almost nothing can survive 70% of revenue.
    const cheap = readSeventyThirty(6500, 500);
    expect(cheap.find((r) => r.base === "of the sale price")?.works).toBe(true);
  });
});

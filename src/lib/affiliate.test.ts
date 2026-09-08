import { describe, expect, it } from "vitest";
import {
  isValidHandle,
  marginCents,
  normalizeHandle,
  ownerTakeCents,
  referralCommissionCents,
  resellerPriceCents,
  splitBreakdown,
} from "./affiliate";

// A pair bought for $23 and listed at $65 — the running example.
const COST = 2300;
const LIST = 6500;
const THIRTY = 3000; // basis points

describe("marginCents", () => {
  it("is list minus cost", () => {
    expect(marginCents(LIST, COST)).toBe(4200);
  });

  it("goes negative on a pair listed under cost", () => {
    expect(marginCents(2000, COST)).toBe(-300);
  });
});

describe("referralCommissionCents", () => {
  it("pays 30% of the margin on a 30/70 split", () => {
    // $42 of margin, 30% of it.
    expect(referralCommissionCents(LIST, COST, THIRTY)).toBe(1260);
  });

  it("scales with the split", () => {
    expect(referralCommissionCents(LIST, COST, 5000)).toBe(2100);
    expect(referralCommissionCents(LIST, COST, 1000)).toBe(420);
  });

  it("pays nothing on a pair with no margin", () => {
    expect(referralCommissionCents(COST, COST, THIRTY)).toBe(0);
  });

  it("never bills the reseller when a pair sells below cost", () => {
    expect(referralCommissionCents(2000, COST, THIRTY)).toBe(0);
  });
});

describe("resellerPriceCents", () => {
  it("hands the pair over at list minus their cut", () => {
    // $65 - $12.60
    expect(resellerPriceCents(LIST, COST, THIRTY)).toBe(5240);
  });

  it("leaves them the same money either way", () => {
    const commission = referralCommissionCents(LIST, COST, THIRTY);
    const price = resellerPriceCents(LIST, COST, THIRTY);
    expect(LIST - price).toBe(commission);
  });

  it("never goes below what you paid", () => {
    // A 100% split would otherwise hand the pair over at cost or less.
    expect(resellerPriceCents(LIST, COST, 10000)).toBe(COST);
    expect(resellerPriceCents(2000, COST, THIRTY)).toBe(COST);
  });
});

describe("ownerTakeCents", () => {
  it("keeps the other 70%", () => {
    expect(ownerTakeCents(LIST, COST, THIRTY)).toBe(6500 - 1260);
  });

  it("plus the commission always equals the list price", () => {
    for (const bps of [0, 1000, 3000, 5000, 9000]) {
      expect(
        ownerTakeCents(LIST, COST, bps) +
          referralCommissionCents(LIST, COST, bps),
      ).toBe(LIST);
    }
  });
});

describe("splitBreakdown", () => {
  it("describes the whole arrangement in one object", () => {
    const split = splitBreakdown(LIST, COST, THIRTY);
    expect(split).toMatchObject({
      listCents: 6500,
      costCents: 2300,
      marginCents: 4200,
      commissionCents: 1260,
      ownerTakeCents: 5240,
      resellerPriceCents: 5240,
      resellerMarginCents: 1260,
    });
  });

  it("gives the reseller the same margin whichever route they take", () => {
    const split = splitBreakdown(LIST, COST, THIRTY);
    expect(split.resellerMarginCents).toBe(split.commissionCents);
  });

  // The $65 -> $62 example works out to a much smaller split than 30/70.
  it("shows what a $3 spread actually is as a split", () => {
    const split = splitBreakdown(6500, 2300, 714);
    expect(split.resellerPriceCents).toBe(6200);
    expect(split.commissionCents).toBe(300);
  });
});

describe("normalizeHandle", () => {
  it("makes a handle safe to print and read out", () => {
    expect(normalizeHandle("  Josh Miller ")).toBe("josh-miller");
    expect(normalizeHandle("J0SH!!")).toBe("j0sh");
    expect(normalizeHandle("--josh--")).toBe("josh");
  });

  it("caps the length", () => {
    expect(normalizeHandle("a".repeat(60))).toHaveLength(30);
  });
});

describe("isValidHandle", () => {
  it("accepts normal handles", () => {
    expect(isValidHandle("josh")).toBe(true);
    expect(isValidHandle("josh-m")).toBe(true);
  });

  it("rejects handles that would break a link", () => {
    expect(isValidHandle("")).toBe(false);
    expect(isValidHandle("j")).toBe(false);
    expect(isValidHandle("-josh")).toBe(false);
    expect(isValidHandle("josh mills")).toBe(false);
  });
});

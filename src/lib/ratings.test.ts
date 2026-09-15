import { describe, expect, it } from "vitest";
import {
  overallVerdict,
  partScaleLabel,
  processScore,
  ratedParts,
  suggestedOverall,
} from "./ratings";

describe("ratedParts", () => {
  it("returns only the parts that were actually scored", () => {
    const parts = ratedParts({ ratingUpper: 4, ratingMidsole: 3 });
    expect(parts.map((p) => p.key)).toEqual(["ratingUpper", "ratingMidsole"]);
  });

  it("ignores nulls and out-of-range values", () => {
    const parts = ratedParts({
      ratingUpper: 4,
      ratingMidsole: null,
      ratingOutsole: 0,
      ratingInsole: 9,
    });
    expect(parts).toHaveLength(1);
  });

  it("is empty when nothing is graded", () => {
    expect(ratedParts({})).toEqual([]);
  });
});

describe("suggestedOverall", () => {
  it("is null with nothing to go on", () => {
    expect(suggestedOverall({})).toBeNull();
  });

  it("gives a perfect pair a 10", () => {
    expect(
      suggestedOverall({
        ratingUpper: 5,
        ratingMidsole: 5,
        ratingOutsole: 5,
        ratingInsole: 5,
        ratingSmell: 5,
      }),
    ).toBe(10);
  });

  // The point of weighting toward the worst part: one bad thing about a shoe
  // is what the buyer remembers and complains about.
  it("punishes one bad part rather than averaging it away", () => {
    const stinks = suggestedOverall({
      ratingUpper: 5,
      ratingMidsole: 5,
      ratingOutsole: 5,
      ratingInsole: 5,
      ratingSmell: 1,
    });
    const evenlyWorn = suggestedOverall({
      ratingUpper: 4,
      ratingMidsole: 4,
      ratingOutsole: 4,
      ratingInsole: 4,
      ratingSmell: 4,
    });
    // A pair that stinks scores below a pair that's merely worn all over,
    // even though its mean is higher.
    expect(stinks).toBeLessThan(evenlyWorn as number);
  });

  it("stays inside 1 to 10", () => {
    const worst = suggestedOverall({
      ratingUpper: 1,
      ratingMidsole: 1,
      ratingOutsole: 1,
      ratingInsole: 1,
      ratingSmell: 1,
    });
    expect(worst).toBeGreaterThanOrEqual(1);
    expect(worst).toBeLessThanOrEqual(10);
  });

  it("works off a single rated part", () => {
    expect(suggestedOverall({ ratingUpper: 3 })).toBe(6);
  });
});

describe("overallVerdict", () => {
  it("names each band in plain words", () => {
    expect(overallVerdict(10).label).toBe("Deadstock");
    expect(overallVerdict(9).label).toBe("Like new");
    expect(overallVerdict(8).label).toBe("Excellent");
    expect(overallVerdict(6).label).toBe("Good");
    expect(overallVerdict(3).label).toBe("Rough");
    expect(overallVerdict(1).label).toBe("Project");
  });

  it("says so when a pair hasn't been graded", () => {
    expect(overallVerdict(null).label).toBe("Not graded");
  });
});

describe("partScaleLabel", () => {
  it("turns a number into something a buyer understands", () => {
    expect(partScaleLabel(5)).toBe("Like new");
    expect(partScaleLabel(1)).toBe("Bad");
    expect(partScaleLabel(null)).toBe("Not rated");
  });
});

describe("processScore", () => {
  it("is a percentage of the steps you offer", () => {
    expect(processScore(8, 10)).toBe(80);
    expect(processScore(0, 10)).toBe(0);
  });

  it("does not divide by zero", () => {
    expect(processScore(3, 0)).toBe(0);
  });
});

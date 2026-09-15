// The grade card.
//
// Two identical Reverse Panda Dunks, one yours and one somebody else's. The
// photos look the same. What tells them apart is this: a number per part of
// the shoe, and a list of what was actually done to it. That's the thing a
// buyer can't get from a Facebook Marketplace post, and it's why they pay
// more for yours.

export const RATING_PARTS = [
  {
    key: "ratingUpper",
    label: "Upper",
    blurb: "Leather, suede or mesh — creasing, scuffs, colour",
  },
  {
    key: "ratingMidsole",
    label: "Midsole",
    blurb: "The white part. Yellowing, scuffs, cracking",
  },
  {
    key: "ratingOutsole",
    label: "Tread",
    blurb: "The bottom. How much life is left in it",
  },
  { key: "ratingInsole", label: "Insole", blurb: "Original, replaced, or worn through" },
  { key: "ratingSmell", label: "Smell", blurb: "Be honest. Everybody checks" },
] as const;

export type RatingKey = (typeof RATING_PARTS)[number]["key"];

/** Plain words for a 1-5, so a buyer never has to guess what a 3 means. */
export const PART_SCALE = [
  { score: 5, label: "Like new", blurb: "No wear worth mentioning" },
  { score: 4, label: "Great", blurb: "Light wear, looks sharp" },
  { score: 3, label: "Good", blurb: "Clear wear, nothing wrong with it" },
  { score: 2, label: "Rough", blurb: "Heavy wear you'll notice straight away" },
  { score: 1, label: "Bad", blurb: "Damaged or worn out" },
] as const;

export function partScaleLabel(score: number | null | undefined): string {
  if (score == null) return "Not rated";
  return PART_SCALE.find((s) => s.score === score)?.label ?? String(score);
}

export interface RatingSet {
  ratingUpper?: number | null;
  ratingMidsole?: number | null;
  ratingOutsole?: number | null;
  ratingInsole?: number | null;
  ratingSmell?: number | null;
}

/** The parts that were actually scored. */
export function ratedParts(
  ratings: RatingSet,
): { key: RatingKey; label: string; blurb: string; score: number }[] {
  return RATING_PARTS.flatMap((part) => {
    const score = ratings[part.key];
    return typeof score === "number" && score >= 1 && score <= 5
      ? [{ key: part.key, label: part.label, blurb: part.blurb, score }]
      : [];
  });
}

/**
 * Suggests an overall out of 10 from the part scores, so you don't have to
 * invent a number and accidentally drift generous over time.
 *
 * Deliberately not a plain average: the worst part of a shoe is what a buyer
 * remembers, so it's weighted toward the low score. A pair that's perfect
 * everywhere except it stinks is not an 8.
 */
export function suggestedOverall(ratings: RatingSet): number | null {
  const parts = ratedParts(ratings);
  if (parts.length === 0) return null;

  const scores = parts.map((p) => p.score);
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const worst = Math.min(...scores);

  // Two parts mean, one part worst — then onto a 10-point scale.
  const weighted = (mean * 2 + worst) / 3;
  return Math.max(1, Math.min(10, Math.round(weighted * 2)));
}

/** What an overall score means, in the words you'd use out loud. */
export function overallVerdict(score: number | null | undefined): {
  label: string;
  blurb: string;
} {
  if (score == null) return { label: "Not graded", blurb: "" };
  if (score >= 10) return { label: "Deadstock", blurb: "Never worn" };
  if (score >= 9)
    return { label: "Like new", blurb: "You'd struggle to tell it was worn" };
  if (score >= 8)
    return { label: "Excellent", blurb: "Light wear, cleaned up sharp" };
  if (score >= 7)
    return { label: "Very good", blurb: "Worn, looked after, nothing wrong" };
  if (score >= 6)
    return { label: "Good", blurb: "Honest wear, cleaned and sound" };
  if (score >= 5)
    return { label: "Fair", blurb: "Been worn properly. Still has road left" };
  if (score >= 3)
    return { label: "Rough", blurb: "Beaters. Priced like it" };
  return { label: "Project", blurb: "For parts or a full restore" };
}

/**
 * How much of the process this pair actually went through, as a share of
 * what you offer. Lets the storefront show "8 of 10 steps" without the
 * buyer having to read the whole list.
 */
export function processScore(
  treatmentCount: number,
  totalTreatments: number,
): number {
  if (totalTreatments <= 0) return 0;
  return Math.round((treatmentCount / totalTreatments) * 100);
}

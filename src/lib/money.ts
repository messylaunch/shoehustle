// Money is integer cents everywhere. These are the only places it becomes a
// string or comes back from a form.

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "—";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = (abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return negative ? `−${s}` : s;
}

/** Whole-dollar display for rough figures: "$65". */
export function formatDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "—";
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/**
 * Parses whatever someone types into a price box — "23", "$23.00", "1,299.99"
 * — into cents. Returns null for anything that isn't a number, so callers can
 * tell "they left it blank" from "they typed zero".
 */
export function parseCents(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[$,\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** parseCents with a fallback, for fields that must produce a number. */
export function parseCentsOr(input: unknown, fallback: number): number {
  const parsed = parseCents(input);
  return parsed === null ? fallback : parsed;
}

/** Cents to the plain decimal string a number input wants: 2350 -> "23.50". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Basis points to a percent string: 1100 -> "11%", 1325 -> "13.25%". */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** "11", "11%", "0.11" are all ambiguous; treat input as a percent. */
export function parseBps(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[%\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function parseBpsOr(input: unknown, fallback: number): number {
  const parsed = parseBps(input);
  return parsed === null ? fallback : parsed;
}

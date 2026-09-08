// The weekly drop.
//
// One hot pair, a countdown, public bidding. The point is a reason to come
// back on a schedule — the auction itself is the marketing.

export interface BidLike {
  amountCents: number;
  bidderEmail: string;
  createdAt: Date;
}

export interface AuctionLike {
  startCents: number;
  incrementCents: number;
  reserveCents?: number | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

/**
 * Highest bid so far, or null when nobody has bid yet.
 * Generic so callers keep the extra fields on their own bid rows.
 */
export function highBid<T extends BidLike>(bids: T[]): T | null {
  if (bids.length === 0) return null;
  return bids.reduce((best, bid) =>
    bid.amountCents > best.amountCents ? bid : best,
  );
}

/** The smallest bid the next person is allowed to place. */
export function minimumBidCents(
  auction: AuctionLike,
  bids: BidLike[],
): number {
  const high = highBid(bids);
  return high === null
    ? auction.startCents
    : high.amountCents + auction.incrementCents;
}

export type AuctionState = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

export function auctionState(auction: AuctionLike, now = new Date()): AuctionState {
  if (auction.status === "CANCELLED") return "CANCELLED";
  if (auction.status === "CLOSED") return "ENDED";
  if (now < auction.startsAt) return "SCHEDULED";
  if (now >= auction.endsAt) return "ENDED";
  return "LIVE";
}

export function isAcceptingBids(auction: AuctionLike, now = new Date()): boolean {
  return auctionState(auction, now) === "LIVE";
}

export interface BidRejection {
  reason: string;
}

/**
 * Checks a bid before it's recorded. Returns null when it's fine.
 * Deliberately strict: a bid that sneaks in a cent under the increment makes
 * the whole thing feel rigged.
 */
export function rejectBid(
  auction: AuctionLike,
  bids: BidLike[],
  amountCents: number,
  now = new Date(),
): BidRejection | null {
  const state = auctionState(auction, now);
  if (state === "SCHEDULED") {
    return { reason: "This drop hasn't opened yet." };
  }
  if (state !== "LIVE") {
    return { reason: "Bidding has closed on this one." };
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { reason: "Put in a real amount." };
  }
  const minimum = minimumBidCents(auction, bids);
  if (amountCents < minimum) {
    return {
      reason: `Bids start at $${(minimum / 100).toFixed(2)} right now.`,
    };
  }
  return null;
}

/** True when the top bid clears the reserve, so the pair actually sells. */
export function reserveMet(auction: AuctionLike, bids: BidLike[]): boolean {
  if (!auction.reserveCents) return bids.length > 0;
  const high = highBid(bids);
  return high !== null && high.amountCents >= auction.reserveCents;
}

/**
 * Everyone who bid and is no longer winning — the people worth telling,
 * and the only ones who asked to hear from you about this pair.
 */
export function outbidEmails(bids: BidLike[]): string[] {
  const high = highBid(bids);
  if (!high) return [];
  const losers = new Set<string>();
  for (const bid of bids) {
    if (bid.bidderEmail !== high.bidderEmail) losers.add(bid.bidderEmail);
  }
  return [...losers];
}

/** "2 days, 4 hours" — for the countdown, without a client-side timer. */
export function timeRemaining(endsAt: Date, now = new Date()): string {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return "Closed";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return "Seconds left";
}

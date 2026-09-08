import { describe, expect, it } from "vitest";
import {
  auctionState,
  highBid,
  isAcceptingBids,
  minimumBidCents,
  outbidEmails,
  rejectBid,
  reserveMet,
  timeRemaining,
} from "./auction";

const NOW = new Date("2026-09-07T12:00:00Z");

const live = {
  startCents: 2500,
  incrementCents: 500,
  reserveCents: null,
  startsAt: new Date("2026-09-06T12:00:00Z"),
  endsAt: new Date("2026-09-10T12:00:00Z"),
  status: "LIVE",
};

const bid = (amountCents: number, bidderEmail: string, minutesAgo = 0) => ({
  amountCents,
  bidderEmail,
  createdAt: new Date(NOW.getTime() - minutesAgo * 60_000),
});

describe("highBid", () => {
  it("is null before anyone bids", () => {
    expect(highBid([])).toBeNull();
  });

  it("finds the top bid regardless of order", () => {
    const bids = [bid(3000, "a@x.com"), bid(4000, "b@x.com"), bid(3500, "c@x.com")];
    expect(highBid(bids)?.bidderEmail).toBe("b@x.com");
  });
});

describe("minimumBidCents", () => {
  it("opens at the start price", () => {
    expect(minimumBidCents(live, [])).toBe(2500);
  });

  it("goes up by the increment once bidding starts", () => {
    expect(minimumBidCents(live, [bid(2500, "a@x.com")])).toBe(3000);
  });
});

describe("auctionState", () => {
  it("is live inside the window", () => {
    expect(auctionState(live, NOW)).toBe("LIVE");
    expect(isAcceptingBids(live, NOW)).toBe(true);
  });

  it("is scheduled before it opens", () => {
    const future = { ...live, startsAt: new Date("2026-09-08T12:00:00Z") };
    expect(auctionState(future, NOW)).toBe("SCHEDULED");
    expect(isAcceptingBids(future, NOW)).toBe(false);
  });

  it("is ended once the timer runs out", () => {
    const past = { ...live, endsAt: new Date("2026-09-07T11:00:00Z") };
    expect(auctionState(past, NOW)).toBe("ENDED");
  });

  it("respects an explicit close or cancel", () => {
    expect(auctionState({ ...live, status: "CLOSED" }, NOW)).toBe("ENDED");
    expect(auctionState({ ...live, status: "CANCELLED" }, NOW)).toBe("CANCELLED");
  });
});

describe("rejectBid", () => {
  it("accepts a bid at the minimum", () => {
    expect(rejectBid(live, [], 2500, NOW)).toBeNull();
  });

  it("rejects a bid a cent under the increment", () => {
    const bids = [bid(2500, "a@x.com")];
    expect(rejectBid(live, bids, 2999, NOW)?.reason).toMatch(/\$30\.00/);
    expect(rejectBid(live, bids, 3000, NOW)).toBeNull();
  });

  it("rejects bidding before it opens", () => {
    const future = { ...live, startsAt: new Date("2026-09-08T12:00:00Z") };
    expect(rejectBid(future, [], 2500, NOW)?.reason).toMatch(/hasn't opened/i);
  });

  it("rejects bidding after it closes", () => {
    const past = { ...live, endsAt: new Date("2026-09-07T11:00:00Z") };
    expect(rejectBid(past, [], 9900, NOW)?.reason).toMatch(/closed/i);
  });

  it("rejects nonsense amounts", () => {
    expect(rejectBid(live, [], 0, NOW)).not.toBeNull();
    expect(rejectBid(live, [], -100, NOW)).not.toBeNull();
    expect(rejectBid(live, [], Number.NaN, NOW)).not.toBeNull();
  });
});

describe("reserveMet", () => {
  it("is met by any bid when there's no reserve", () => {
    expect(reserveMet(live, [])).toBe(false);
    expect(reserveMet(live, [bid(2500, "a@x.com")])).toBe(true);
  });

  it("needs the top bid to clear the reserve", () => {
    const reserved = { ...live, reserveCents: 5000 };
    expect(reserveMet(reserved, [bid(4500, "a@x.com")])).toBe(false);
    expect(reserveMet(reserved, [bid(5000, "a@x.com")])).toBe(true);
  });
});

describe("outbidEmails", () => {
  it("is empty with no bids", () => {
    expect(outbidEmails([])).toEqual([]);
  });

  it("leaves out whoever is winning", () => {
    const bids = [bid(2500, "a@x.com"), bid(3000, "b@x.com")];
    expect(outbidEmails(bids)).toEqual(["a@x.com"]);
  });

  it("doesn't tell the same person twice", () => {
    const bids = [
      bid(2500, "a@x.com"),
      bid(3000, "a@x.com"),
      bid(3500, "b@x.com"),
    ];
    expect(outbidEmails(bids)).toEqual(["a@x.com"]);
  });
});

describe("timeRemaining", () => {
  it("counts down in days, then hours, then minutes", () => {
    expect(timeRemaining(new Date("2026-09-10T12:00:00Z"), NOW)).toBe("3d 0h left");
    expect(timeRemaining(new Date("2026-09-07T16:30:00Z"), NOW)).toBe("4h 30m left");
    expect(timeRemaining(new Date("2026-09-07T12:20:00Z"), NOW)).toBe("20m left");
    expect(timeRemaining(new Date("2026-09-07T12:00:30Z"), NOW)).toBe("Seconds left");
  });

  it("says closed once it's over", () => {
    expect(timeRemaining(new Date("2026-09-07T11:00:00Z"), NOW)).toBe("Closed");
  });
});

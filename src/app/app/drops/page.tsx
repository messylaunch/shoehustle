import Link from "next/link";
import { Empty, Field, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatSize } from "@/lib/constants";
import { auctionState, highBid, reserveMet, timeRemaining } from "@/lib/auction";
import { shoeName } from "@/lib/research";
import { cancelDropAction, closeDropAction, createDropAction } from "../actions";

export const metadata = { title: "Drops" };
export const dynamic = "force-dynamic";

// One hot pair on a timer, run to a schedule. The auction is the marketing:
// it gives people a reason to come back on a day they can predict.

export default async function DropsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; closed?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const mine = user.role === "ADMIN" ? {} : { sellerId: user.id };

  const [auctions, candidates] = await Promise.all([
    prisma.auction.findMany({
      where: { item: mine },
      include: {
        item: { include: { shoe: true } },
        bids: { orderBy: { amountCents: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Only pairs that are actually listed can be dropped.
    prisma.inventoryItem.findMany({
      where: { ...mine, status: "LISTED" },
      include: { shoe: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Default the timer to a week out, which is the cadence worth keeping.
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const defaultEnds = nextWeek.toISOString().slice(0, 16);

  return (
    <>
      <h1>Drops</h1>
      <p className="muted prose">
        One pair, a countdown, public bidding. Run it on the same day every
        week and people learn to show up for it — that habit is worth more
        than what any single pair sells for.
      </p>

      {sp.created ? <Notice kind="good">Drop is live.</Notice> : null}
      {sp.closed ? <Notice kind="good">Drop closed.</Notice> : null}
      {sp.error === "ends" ? (
        <Notice kind="bad">Pick a closing time in the future.</Notice>
      ) : null}
      {sp.error === "item" ? (
        <Notice kind="bad">That pair isn&apos;t yours to drop.</Notice>
      ) : null}

      <h2>Running now</h2>
      {auctions.length === 0 ? (
        <Empty title="No drops yet">
          Pick a pair below — the hottest thing you own, not the one you most
          want rid of. The point is to pull a crowd.
        </Empty>
      ) : (
        <div className="stack">
          {auctions.map((auction) => {
            const state = auctionState(auction);
            const top = highBid(auction.bids);
            return (
              <div className="card" key={auction.id}>
                <div className="spread">
                  <div>
                    <strong>
                      <Link href={`/drop/${auction.id}`} target="_blank">
                        {auction.title || shoeName(auction.item.shoe)}
                      </Link>
                    </strong>
                    <div className="small muted">
                      {formatSize(auction.item.size, auction.item.sizeType)} ·{" "}
                      {auction.bids.length}{" "}
                      {auction.bids.length === 1 ? "bid" : "bids"} ·{" "}
                      {top
                        ? `at ${formatCents(top.amountCents)}`
                        : `opens at ${formatCents(auction.startCents)}`}
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      state === "LIVE"
                        ? "badge-warn"
                        : state === "ENDED"
                          ? "badge-good"
                          : ""
                    }`}
                  >
                    {state === "LIVE" ? timeRemaining(auction.endsAt) : state}
                  </span>
                </div>

                {auction.reserveCents ? (
                  <p className="tiny" style={{ marginTop: "0.4rem" }}>
                    Reserve {formatCents(auction.reserveCents)} —{" "}
                    {reserveMet(auction, auction.bids) ? (
                      <span style={{ color: "var(--good)" }}>met</span>
                    ) : (
                      <span style={{ color: "var(--warn)" }}>not met yet</span>
                    )}
                  </p>
                ) : null}

                {top ? (
                  <p className="small" style={{ marginTop: "0.5rem" }}>
                    Winning: <strong>{top.bidderName}</strong> ({top.bidderEmail})
                  </p>
                ) : null}

                {auction.status === "LIVE" ? (
                  <div className="row" style={{ marginTop: "0.6rem" }}>
                    <form action={closeDropAction}>
                      <input type="hidden" name="id" value={auction.id} />
                      <button className="btn btn-small" type="submit">
                        {state === "ENDED" ? "Settle it" : "Close early"}
                      </button>
                    </form>
                    <form action={cancelDropAction}>
                      <input type="hidden" name="id" value={auction.id} />
                      <button className="btn btn-small btn-danger" type="submit">
                        Cancel
                      </button>
                    </form>
                  </div>
                ) : null}

                {state === "ENDED" && auction.status === "LIVE" ? (
                  <p className="tiny" style={{ marginTop: "0.4rem" }}>
                    Timer&apos;s up. Settle it to mark the pair sold and get the
                    winner&apos;s details.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <h2>Start a drop</h2>
      {candidates.length === 0 ? (
        <Empty
          title="Nothing listed to drop"
          action={{ href: "/app/inventory", label: "Go list something" }}
        >
          A pair has to be listed before it can go up for bidding.
        </Empty>
      ) : (
        <div className="card">
          <form action={createDropAction}>
            <Field
              label="Which pair?"
              hint="Pick the one people actually want. A drop on a slow pair teaches people the drop isn't worth watching."
            >
              <select name="itemId" required>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {shoeName(item.shoe)} — {formatSize(item.size, item.sizeType)}
                    {item.listPriceCents
                      ? ` (${formatCents(item.listPriceCents)})`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Headline" hint="Optional. Defaults to the shoe's name.">
              <input name="title" placeholder="Friday drop — Jordan 4s" />
            </Field>

            <div className="cols-2">
              <Field
                label="Opening bid"
                hint="Go low. A cheap opening bid pulls people in; the crowd sets the real price."
              >
                <input name="startPrice" inputMode="decimal" placeholder="25.00" />
              </Field>
              <Field
                label="Reserve"
                hint="Optional, and hidden from bidders. Below this you don't have to sell."
              >
                <input name="reserve" inputMode="decimal" placeholder="45.00" />
              </Field>
            </div>

            <div className="cols-2">
              <Field label="Bid increment">
                <input name="increment" inputMode="decimal" placeholder="5.00" />
              </Field>
              <Field label="Closes">
                <input
                  type="datetime-local"
                  name="endsAt"
                  required
                  defaultValue={defaultEnds}
                />
              </Field>
            </div>

            <button className="btn btn-primary" type="submit">
              Start the drop
            </button>
            <p className="tiny" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              The pair gets held while bidding runs, so nobody can buy it out
              from under the auction.
            </p>
          </form>
        </div>
      )}

      <h2>How to run these</h2>
      <div className="card prose small">
        <ul className="tight" style={{ marginBottom: 0 }}>
          <li>
            <strong>Same day, every week.</strong> Predictability is the whole
            mechanism. "Friday drop" beats a surprise auction every time.
          </li>
          <li>
            <strong>Use a pair people want,</strong> not one you're stuck with.
            The drop is advertising; a dud teaches people to ignore it.
          </li>
          <li>
            <strong>Open low.</strong> A $25 opening bid gets ten people
            involved. A $60 opening bid gets nobody, and an empty auction looks
            worse than no auction.
          </li>
          <li>
            <strong>Set a reserve</strong> if you'd genuinely regret selling
            cheap. Bidders never see it.
          </li>
          <li>
            <strong>Nobody's card is charged.</strong> The winner gets contacted
            and pays then — which keeps a marketing feature from turning into a
            refunds problem.
          </li>
        </ul>
      </div>
    </>
  );
}

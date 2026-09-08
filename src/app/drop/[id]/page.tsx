import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicShell from "@/components/PublicShell";
import { GradeBadge, Notice } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import {
  flawByCode,
  formatSize,
  parseFlaws,
  parseTreatments,
  treatmentByCode,
} from "@/lib/constants";
import {
  auctionState,
  highBid,
  minimumBidCents,
  reserveMet,
  timeRemaining,
} from "@/lib/auction";
import { shoeName } from "@/lib/research";
import { placeBidAction } from "@/app/actions";

export const dynamic = "force-dynamic";

async function loadAuction(id: string) {
  return prisma.auction.findUnique({
    where: { id },
    include: {
      item: { include: { shoe: true, photos: { orderBy: { sort: "asc" } } } },
      bids: { orderBy: { amountCents: "desc" } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const auction = await loadAuction(id);
  if (!auction) return { title: "Drop not found" };

  const top = highBid(auction.bids);
  const title = auction.title || `${shoeName(auction.item.shoe)} — the drop`;

  return {
    title,
    description: top
      ? `At ${formatCents(top.amountCents)} with ${auction.bids.length} bids. ${timeRemaining(auction.endsAt)}.`
      : `Opens at ${formatCents(auction.startCents)}. ${timeRemaining(auction.endsAt)}.`,
    openGraph: {
      title,
      images: auction.item.photos[0]
        ? [{ url: auction.item.photos[0].url }]
        : undefined,
    },
  };
}

export default async function DropPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bid?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const auction = await loadAuction(id);
  if (!auction) notFound();

  const state = auctionState(auction);
  const top = highBid(auction.bids);
  const minimum = minimumBidCents(auction, auction.bids);
  const flaws = parseFlaws(auction.item.flaws);
  const treatments = parseTreatments(auction.item.treatments);

  return (
    <PublicShell>
      <p className="small">
        <Link href="/">← Everything in stock</Link>
      </p>

      {sp.bid === "ok" ? (
        <Notice kind="good" title="Bid's in">
          You&apos;re top of the pile. If someone goes over you and
          you&apos;ve got notifications on, I&apos;ll tell you — otherwise
          check back before the timer runs out.
        </Notice>
      ) : null}
      {sp.error ? (
        <Notice kind="bad">{decodeURIComponent(sp.error)}</Notice>
      ) : null}

      <h1>{auction.title || shoeName(auction.item.shoe)}</h1>

      <div className="row">
        <span className="badge badge-info">
          {formatSize(auction.item.size, auction.item.sizeType)}
        </span>
        <GradeBadge grade={auction.item.grade} />
        <span
          className={`badge ${state === "LIVE" ? "badge-warn" : ""}`}
        >
          {state === "LIVE"
            ? timeRemaining(auction.endsAt)
            : state === "SCHEDULED"
              ? "Opens soon"
              : "Closed"}
        </span>
      </div>

      {auction.item.photos.length > 0 ? (
        <div className="gallery" style={{ marginTop: "1rem" }}>
          {auction.item.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={photo.url} alt={shoeName(auction.item.shoe)} />
          ))}
        </div>
      ) : null}

      <h2>
        {top ? formatCents(top.amountCents) : formatCents(auction.startCents)}
        <span
          className="muted"
          style={{ fontSize: "1rem", fontWeight: 400, marginLeft: "0.5rem" }}
        >
          {top
            ? `${auction.bids.length} ${auction.bids.length === 1 ? "bid" : "bids"}`
            : "opening price"}
        </span>
      </h2>

      {auction.item.marketNewCents ? (
        <p className="small muted">
          A new pair runs about {formatCents(auction.item.marketNewCents)}.
        </p>
      ) : null}

      {state === "LIVE" ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            Next bid: {formatCents(minimum)} or more
          </h3>
          <p className="small muted">
            No card needed. If you win, I&apos;ll email you and you pay then.
            Bids go up in {formatCents(auction.incrementCents)} steps.
          </p>
          <form action={placeBidAction}>
            <input type="hidden" name="auctionId" value={auction.id} />
            <div className="cols-2">
              <div className="field">
                <label htmlFor="bid-name">Your name</label>
                <input id="bid-name" name="name" required />
              </div>
              <div className="field">
                <label htmlFor="bid-email">Email</label>
                <input id="bid-email" name="email" type="email" required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="bid-amount">Your bid</label>
              <input
                id="bid-amount"
                name="amount"
                inputMode="decimal"
                required
                placeholder={(minimum / 100).toFixed(2)}
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              Place bid
            </button>
          </form>
        </div>
      ) : state === "ENDED" ? (
        <Notice kind="info" title="This one's done">
          {top
            ? reserveMet(auction, auction.bids)
              ? `Went for ${formatCents(top.amountCents)}. Another drop's coming — get on the list so you hear about it first.`
              : "Didn't hit the reserve, so it goes back in stock."
            : "Nobody bid on this one."}
        </Notice>
      ) : (
        <Notice kind="info" title="Not open yet">
          Bidding opens{" "}
          {auction.startsAt.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
          .
        </Notice>
      )}

      {treatments.length > 0 ? (
        <>
          <h3>What I did to them</h3>
          <ul className="tight">
            {treatments.map((code) => (
              <li key={code}>{treatmentByCode(code)?.label ?? code}</li>
            ))}
          </ul>
        </>
      ) : null}

      {flaws.length > 0 || auction.item.flawNotes ? (
        <>
          <h3>What isn&apos;t perfect</h3>
          <div className="notice notice-warn">
            <ul className="tight" style={{ margin: 0 }}>
              {flaws.map((code) => (
                <li key={code}>{flawByCode(code)?.label ?? code}</li>
              ))}
              {auction.item.flawNotes ? <li>{auction.item.flawNotes}</li> : null}
            </ul>
          </div>
        </>
      ) : null}

      {auction.bids.length > 0 ? (
        <>
          <h3>Bids</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bidder</th>
                  <th className="right">Amount</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {auction.bids.slice(0, 12).map((bid, i) => (
                  <tr key={bid.id}>
                    <td>
                      {/* First name only — the rest is nobody's business. */}
                      {bid.bidderName.split(" ")[0]}
                      {i === 0 ? (
                        <span className="badge badge-good" style={{ marginLeft: "0.4rem" }}>
                          winning
                        </span>
                      ) : null}
                    </td>
                    <td className="right num">{formatCents(bid.amountCents)}</td>
                    <td className="tiny">
                      {bid.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </PublicShell>
  );
}

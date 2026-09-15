import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { GradeBadge, Notice, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatSize, PUBLIC_STATUSES } from "@/lib/constants";
import { shoeName } from "@/lib/research";
import { getSettings } from "@/lib/settings";
import { referringReseller } from "@/lib/referral";
import { auctionState, highBid, timeRemaining } from "@/lib/auction";
import { formatMeet } from "@/lib/pickup";
import InstallPrompt from "@/components/InstallPrompt";
import { sizeAlertAction } from "./actions";

export const dynamic = "force-dynamic";

// The storefront. No login to browse, size filter first, every pair links to
// its own page so a Facebook post gets a real preview card.

export default async function StorefrontPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string; alert?: string }>;
}) {
  const params = await searchParams;
  const activeSize = params.size?.trim() || null;
  const settings = await getSettings();
  const referrer = await referringReseller();

  // The weekly drop, if one is running. It's the reason to come back.
  const liveAuction = await prisma.auction.findFirst({
    where: { status: "LIVE", endsAt: { gt: new Date() } },
    include: {
      item: { include: { shoe: true, photos: { take: 1, orderBy: { sort: "asc" } } } },
      bids: true,
    },
    orderBy: { endsAt: "asc" },
  });
  const auctionTop = liveAuction ? highBid(liveAuction.bids) : null;

  const meets = await prisma.pickupLocation.findMany({
    where: { active: true },
    orderBy: { dayOfWeek: "asc" },
  });

  const items = await prisma.inventoryItem.findMany({
    where: {
      status: { in: [...PUBLIC_STATUSES] },
      ...(activeSize ? { size: activeSize } : {}),
    },
    include: { shoe: true, photos: { orderBy: { sort: "asc" }, take: 1 } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  // Sizes come from what's actually in stock, so the filter never offers a
  // size that returns an empty page.
  const inStock = await prisma.inventoryItem.findMany({
    where: { status: { in: [...PUBLIC_STATUSES] } },
    select: { size: true, sizeType: true },
  });
  const sizes = [...new Set(inStock.map((i) => i.size))].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );

  return (
    <PublicShell>
      <h1>{settings.shopName}</h1>
      <p className="muted">{settings.tagline}</p>

      {referrer ? (
        <p className="tiny">
          Shopping with <strong>{referrer.name}</strong>
        </p>
      ) : null}

      {params.alert === "ok" ? (
        <Notice kind="good" title="You're on the list">
          I'll message you the moment something lands in your size.
        </Notice>
      ) : null}

      {liveAuction && auctionState(liveAuction) === "LIVE" ? (
        <>
          <h2>This week&apos;s drop</h2>
          <Link
            href={`/drop/${liveAuction.id}`}
            className="card"
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <div className="spread">
              <div>
                <strong>
                  {liveAuction.title || shoeName(liveAuction.item.shoe)}
                </strong>
                <div className="small muted">
                  {formatSize(liveAuction.item.size, liveAuction.item.sizeType)} ·{" "}
                  {auctionTop
                    ? `${formatCents(auctionTop.amountCents)} — ${liveAuction.bids.length} ${
                        liveAuction.bids.length === 1 ? "bid" : "bids"
                      }`
                    : `Opens at ${formatCents(liveAuction.startCents)}`}
                </div>
              </div>
              <span className="badge badge-warn">
                {timeRemaining(liveAuction.endsAt)}
              </span>
            </div>
          </Link>
        </>
      ) : null}

      {sizes.length > 0 ? (
        <>
          <h2>Shop your size</h2>
          <div className="size-filter">
            <Link
              href="/"
              className={`size-chip ${activeSize ? "" : "on"}`}
            >
              All sizes
            </Link>
            {sizes.map((size) => (
              <Link
                key={size}
                href={`/?size=${encodeURIComponent(size)}`}
                className={`size-chip ${activeSize === size ? "on" : ""}`}
              >
                {size}
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {meets.length > 0 ? (
        <div className="notice notice-good" style={{ marginTop: "1rem" }}>
          <strong>Pick up free, no shipping wait</strong>
          <span className="small">
            {meets.map((meet) => formatMeet(meet)).join(" · ")}. Buy on here
            first, then come and grab them — everything&apos;s paid for before
            the meet, so it&apos;s a thirty-second handover.
          </span>
        </div>
      ) : null}

      <h2>
        {activeSize ? `Size ${activeSize}` : "Everything in stock"}{" "}
        <span className="muted small">
          ({items.length} {items.length === 1 ? "pair" : "pairs"})
        </span>
      </h2>

      {items.length === 0 ? (
        <div className="card">
          <p style={{ marginBottom: 0 }}>
            {activeSize
              ? `Nothing in a ${activeSize} right now.`
              : "Nothing listed yet — check back shortly."}
          </p>
        </div>
      ) : (
        <div className="shoe-grid">
          {items.map((item) => (
            <Link key={item.id} href={`/shoe/${item.id}`} className="shoe-card">
              <div className="shoe-photo">
                {item.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photos[0].url} alt={shoeName(item.shoe)} />
                ) : (
                  <span className="placeholder">No photo yet</span>
                )}
              </div>
              <div className="shoe-card-body">
                <span className="shoe-card-name">{shoeName(item.shoe)}</span>
                <span className="tiny">
                  {formatSize(item.size, item.sizeType)}
                </span>
                <div className="row" style={{ gap: "0.3rem" }}>
                  <GradeBadge grade={item.grade} />
                  {item.status !== "LISTED" ? (
                    <StatusBadge status={item.status} />
                  ) : null}
                </div>
                <span className="shoe-card-price">
                  {item.status === "SOLD"
                    ? "Sold"
                    : formatCents(item.listPriceCents)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <h2>Not your size?</h2>
      <div className="card">
        <p className="small muted">
          Every pair here is one-of-one, so sizes come and go. Tell me what you
          wear and I'll message you when yours lands. Shopping for someone
          else too? Add their size and I'll watch that as well.
        </p>
        <form action={sizeAlertAction}>
          <div className="cols-2">
            <div className="field">
              <label htmlFor="alert-email">Email</label>
              <input
                id="alert-email"
                type="email"
                name="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="field">
              <label htmlFor="alert-size">Size</label>
              <input
                id="alert-size"
                type="text"
                name="size"
                required
                placeholder="10.5"
                inputMode="decimal"
              />
            </div>
          </div>
          <div className="cols-2">
            <div className="field">
              <label htmlFor="alert-for">Who's it for?</label>
              <select id="alert-for" name="forWho" defaultValue="me">
                <option value="me">Me</option>
                <option value="my son">My son</option>
                <option value="my daughter">My daughter</option>
                <option value="my partner">My partner</option>
                <option value="a gift">A gift</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="alert-note">Anything you're hunting for?</label>
              <input
                id="alert-note"
                type="text"
                name="note"
                placeholder="Jordan 4s, anything under $60…"
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            Tell me when this size drops
          </button>
          <p className="tiny" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            Add the form again for each size you want watched.
          </p>
        </form>
      </div>

      <h2>Get it first</h2>
      <InstallPrompt
        vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        shopName={settings.shopName}
      />

      <h2>Beat-up pair you still love?</h2>
      <div className="card">
        <p className="small">{settings.restorationBlurb}</p>
        <div className="row">
          <Link className="btn" href="/restoration">
            Get a restoration quote
          </Link>
          <Link className="btn btn-ghost" href="/trade">
            Sell or trade your old pairs
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { GradeBadge, Notice, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatSize, PUBLIC_STATUSES } from "@/lib/constants";
import { shoeName } from "@/lib/research";
import { getSettings } from "@/lib/settings";
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

      {params.alert === "ok" ? (
        <Notice kind="good" title="You're on the list">
          I'll message you the moment something lands in your size.
        </Notice>
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
          Tell me what you wear and I'll message you the moment a pair lands.
          No spam, no list rental — just a heads up when your size drops.
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
              <label htmlFor="alert-size">Your size</label>
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
          <div className="field">
            <label htmlFor="alert-note">Anything you're hunting for?</label>
            <input
              id="alert-note"
              type="text"
              name="note"
              placeholder="Jordan 4s, anything New Balance, under $80…"
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Tell me when my size drops
          </button>
        </form>
      </div>

      <h2>Beat-up pair you still love?</h2>
      <div className="card">
        <p className="small">{settings.restorationBlurb}</p>
        <Link className="btn" href="/restoration">
          Get a restoration quote
        </Link>
      </div>
    </PublicShell>
  );
}

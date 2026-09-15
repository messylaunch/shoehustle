import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicShell from "@/components/PublicShell";
import GradeCard from "@/components/GradeCard";
import { GradeBadge, Notice, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canTakePayments } from "@/lib/config";
import { formatCents } from "@/lib/money";
import {
  flawByCode,
  formatSize,
  gradeByCode,
  isBuyableStatus,
  isPublicStatus,
  parseFlaws,
  parseTreatments,
  sizeTypeLabel,
  treatmentByCode,
} from "@/lib/constants";
import { researchLinks, shoeName } from "@/lib/research";
import { resellerPriceCents } from "@/lib/affiliate";
import { currentUser } from "@/lib/auth";
import { referringReseller } from "@/lib/referral";
import { formatMeet } from "@/lib/pickup";
import { getSettings } from "@/lib/settings";
import { checkoutAction } from "@/app/actions";

export const dynamic = "force-dynamic";

async function loadItem(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      shoe: true,
      seller: true,
      photos: { orderBy: { sort: "asc" } },
    },
  });
  if (!item || !isPublicStatus(item.status)) return null;
  return item;
}

// Every pair gets a real preview card, so a link pasted into Facebook shows
// the shoe, the size and the price instead of a bare URL.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await loadItem(id);
  if (!item) return { title: "Not found" };

  const name = shoeName(item.shoe);
  const size = formatSize(item.size, item.sizeType);
  const price =
    item.status === "SOLD" ? "Sold" : formatCents(item.listPriceCents);
  const title = `${name} — ${size}`;
  const description = `${price} · ${gradeByCode(item.grade)?.label ?? item.grade}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: item.photos[0] ? [{ url: item.photos[0].url }] : undefined,
      type: "website",
    },
    twitter: {
      card: item.photos[0] ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function ShoePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const item = await loadItem(id);
  if (!item) notFound();

  const settings = await getSettings();
  const grade = gradeByCode(item.grade);
  const buyable = isBuyableStatus(item.status) && (item.listPriceCents ?? 0) > 0;
  const paymentsOn = canTakePayments() && item.seller.stripeReady;

  const flaws = parseFlaws(item.flaws);
  const treatments = parseTreatments(item.treatments);
  const [viewer, referrer] = await Promise.all([
    currentUser(),
    referringReseller(),
  ]);

  // What someone in the network pays for this pair. Only shown to a signed-in
  // reseller — a shopper seeing a lower price than the one they're being
  // asked for is a bad experience, not a sales tool.
  const networkPrice =
    viewer?.isReseller && item.listPriceCents
      ? resellerPriceCents(
          item.listPriceCents,
          item.costCents,
          viewer.commissionBps,
        )
      : null;

  // The "here's the deal" links. Google Shopping and StockX show what the
  // pair goes for new, so the discount is visible rather than claimed.
  const valueLinks = researchLinks(item.shoe, { size: item.size }).filter((l) =>
    ["StockX", "Google Shopping", "GOAT"].includes(l.label),
  );

  const meets = await prisma.pickupLocation.findMany({
    where: { active: true },
    orderBy: { dayOfWeek: "asc" },
  });

  const checkoutMessage: Record<string, { kind: "warn" | "bad"; text: string }> =
    {
      cancelled: { kind: "warn", text: "Checkout cancelled — the pair is still here." },
      unavailable: { kind: "warn", text: "That pair isn't available to buy right now." },
      noprice: { kind: "warn", text: "This pair doesn't have a price on it yet." },
      off: { kind: "warn", text: "Card checkout isn't switched on yet. Message to buy." },
      seller: { kind: "warn", text: "This seller hasn't finished payment setup yet." },
      failed: { kind: "bad", text: "Stripe couldn't start that checkout. Try again." },
    };
  const message = checkout ? checkoutMessage[checkout] : undefined;

  return (
    <PublicShell>
      <p className="small">
        <Link href="/">← Everything in stock</Link>
        {" · "}
        <Link href={`/?size=${encodeURIComponent(item.size)}`}>
          More in {item.size}
        </Link>
      </p>

      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

      {referrer ? (
        <p className="tiny">
          Shopping with <strong>{referrer.name}</strong>
        </p>
      ) : null}

      <h1>{shoeName(item.shoe)}</h1>

      <div className="row">
        <span className="badge badge-info">
          {formatSize(item.size, item.sizeType)}
        </span>
        <GradeBadge grade={item.grade} />
        <StatusBadge status={item.status} />
        {item.shoe.styleCode ? (
          <span className="badge mono">{item.shoe.styleCode}</span>
        ) : null}
      </div>

      {item.photos.length > 0 ? (
        <div className="gallery" style={{ marginTop: "1rem" }}>
          {item.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={photo.url} alt={shoeName(item.shoe)} />
          ))}
        </div>
      ) : null}

      <h2>
        {item.status === "SOLD" ? "Sold" : formatCents(item.listPriceCents)}
        {item.marketNewCents && item.status !== "SOLD" ? (
          <span
            className="muted"
            style={{ fontSize: "1rem", fontWeight: 400, marginLeft: "0.5rem" }}
          >
            <s>{formatCents(item.marketNewCents)}</s> new
          </span>
        ) : null}
      </h2>

      {networkPrice !== null ? (
        <Notice kind="info" title={`Your price: ${formatCents(networkPrice)}`}>
          <span className="small">
            That&apos;s what you pay as a reseller. Sell it on at{" "}
            {formatCents(item.listPriceCents)} and you keep{" "}
            {formatCents((item.listPriceCents ?? 0) - networkPrice)}. Or just
            share your link and earn the same without touching the shoe.
          </span>
        </Notice>
      ) : null}

      {item.status === "IN_RESTORATION" ? (
        <Notice kind="warn" title="Being restored right now">
          {item.restorationEta
            ? `Ready ${item.restorationEta.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}. `
            : ""}
          {item.restorationNotes ||
            "It's mid-clean, so it isn't for sale yet — but message me and I'll hold it for you."}
        </Notice>
      ) : null}

      {item.status === "RESERVED" ? (
        <Notice kind="info" title="On hold">
          Someone's claiming this one. Message me and I'll tell you if it frees
          up.
        </Notice>
      ) : null}

      <GradeCard
        ratings={item}
        overall={item.ratingOverall}
        treatments={item.treatments}
      />

      <div className="card">
        <p className="small">
          <strong>Condition: {grade?.label ?? item.grade}</strong>
          <br />
          <span className="muted">{grade?.blurb}</span>
        </p>
        <p className="small">
          <strong>Size:</strong> {item.size} {sizeTypeLabel(item.sizeType)}
        </p>
        {item.notes ? <p className="small">{item.notes}</p> : null}
      </div>

      {flaws.length > 0 || item.flawNotes ? (
        <>
          <h3>What isn&apos;t perfect</h3>
          <div className="notice notice-warn">
            <strong>These are secondhand, so here&apos;s the honest bit</strong>
            <ul className="tight" style={{ margin: "0.5rem 0 0" }}>
              {flaws.map((code) => {
                const f = flawByCode(code);
                return (
                  <li key={code}>
                    <strong>{f?.label ?? code}</strong>
                    {f?.blurb ? (
                      <span className="muted"> — {f.blurb}</span>
                    ) : null}
                  </li>
                );
              })}
              {item.flawNotes ? <li>{item.flawNotes}</li> : null}
            </ul>
            <p className="small" style={{ margin: "0.6rem 0 0" }}>
              I&apos;d rather tell you now than have you open the box and find
              it. If any of this is a dealbreaker, don&apos;t buy them.
            </p>
          </div>
        </>
      ) : null}

      {buyable ? (
        paymentsOn ? (
          <form action={checkoutAction} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="itemId" value={item.id} />

            {meets.length > 0 ? (
              <div className="card" style={{ marginBottom: "0.8rem" }}>
                <h3 style={{ marginTop: 0 }}>How do you want them?</h3>
                <label
                  style={{ fontWeight: 400, display: "block", marginBottom: "0.5rem" }}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value="PICKUP"
                    defaultChecked
                    style={{ width: "auto", marginRight: "0.4rem" }}
                  />
                  <strong>Pick it up — free</strong>
                </label>
                <div className="field" style={{ marginLeft: "1.3rem" }}>
                  <select name="pickupLocationId" defaultValue={meets[0].id}>
                    {meets.map((meet) => (
                      <option key={meet.id} value={meet.id}>
                        {formatMeet(meet)}
                      </option>
                    ))}
                  </select>
                  <div className="hint">
                    {meets[0].notes ??
                      "Same spot, same time, every week. I'll have them with me."}
                  </div>
                </div>

                <label style={{ fontWeight: 400, display: "block" }}>
                  <input
                    type="radio"
                    name="fulfillment"
                    value="SHIPPING"
                    style={{ width: "auto", marginRight: "0.4rem" }}
                  />
                  <strong>
                    Ship them — {formatCents(item.seller.buyerShippingCents)}
                  </strong>
                </label>
              </div>
            ) : (
              <input type="hidden" name="fulfillment" value="SHIPPING" />
            )}

            <button className="btn btn-primary btn-block" type="submit">
              Buy — {formatCents(item.listPriceCents)}
            </button>
            <p className="tiny" style={{ marginTop: "0.5rem" }}>
              {meets.length > 0
                ? "Paid before you collect, so nobody's handling cash at the meet. "
                : `Shipping ${formatCents(item.seller.buyerShippingCents)}, added at checkout. `}
              Card handled by Stripe.
            </p>
          </form>
        ) : (
          <div style={{ marginTop: "1rem" }}>
            {meets.length > 0 ? (
              <Notice kind="good" title="How do you want them?">
                <span className="small">
                  Pick up free at {meets.map((m) => formatMeet(m)).join(" or ")}
                  , or I&apos;ll ship them for{" "}
                  {formatCents(item.seller.buyerShippingCents)}. Say which when
                  you message me.
                </span>
              </Notice>
            ) : null}
            {settings.contactUrl ? (
              <a
                className="btn btn-primary btn-block"
                href={settings.contactUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Message to buy
              </a>
            ) : (
              <Notice kind="info" title="Message me to buy">
                {settings.contactLine}
              </Notice>
            )}
          </div>
        )
      ) : null}

      {item.status !== "SOLD" ? (
        <>
          <h3>Check what these go for</h3>
          <p className="small muted">
            Don&apos;t take my word for the price. These open a search for this
            exact pair so you can see what a new one costs.
          </p>
          <div className="linkgrid">
            {valueLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="linkcard"
              >
                <div className="lc-name">{link.label}</div>
                <div className="lc-hint">
                  {link.label === "StockX"
                    ? "What a deadstock pair sells for right now."
                    : link.label === "GOAT"
                      ? "Used pairs listed by condition."
                      : "Prices across the resale sites in one go."}
                </div>
              </a>
            ))}
          </div>
        </>
      ) : null}
    </PublicShell>
  );
}

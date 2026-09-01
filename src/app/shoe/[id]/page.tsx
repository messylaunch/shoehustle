import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicShell from "@/components/PublicShell";
import { GradeBadge, Notice, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canTakePayments } from "@/lib/config";
import { formatCents } from "@/lib/money";
import {
  formatSize,
  gradeByCode,
  isBuyableStatus,
  isPublicStatus,
  sizeTypeLabel,
} from "@/lib/constants";
import { shoeName } from "@/lib/research";
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
      </h2>

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

      {buyable ? (
        paymentsOn ? (
          <form action={checkoutAction} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-primary btn-block" type="submit">
              Buy — {formatCents(item.listPriceCents)}
            </button>
            <p className="tiny" style={{ marginTop: "0.5rem" }}>
              Shipping {formatCents(item.seller.buyerShippingCents)}, added at
              checkout. Card handled by Stripe.
            </p>
          </form>
        ) : (
          <div style={{ marginTop: "1rem" }}>
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

      <div className="footer">{settings.contactLine}</div>
    </PublicShell>
  );
}

import Link from "next/link";
import { Empty, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { formatBps, formatCents } from "@/lib/money";
import { splitBreakdown } from "@/lib/affiliate";
import { shoeName } from "@/lib/research";

export const metadata = { title: "Network" };
export const dynamic = "force-dynamic";

// Two audiences on one page: a reseller seeing what they've earned, and the
// owner seeing what they owe.

export default async function NetworkPage() {
  const user = await requireUser();

  const [myReferrals, owedRows, resellers] = await Promise.all([
    prisma.order.findMany({
      where: { resellerId: user.id },
      include: { item: { include: { shoe: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        sellerId: user.id,
        resellerId: { not: null },
        status: { in: ["PAID", "SHIPPED"] },
      },
      include: {
        reseller: { select: { id: true, name: true, email: true } },
        item: { include: { shoe: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { isReseller: true, active: true },
          select: {
            id: true,
            name: true,
            handle: true,
            commissionBps: true,
            _count: { select: { referredOrders: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const earned = myReferrals
    .filter((o) => o.status === "PAID" || o.status === "SHIPPED")
    .reduce((sum, o) => sum + o.resellerCutCents, 0);

  // What you owe, grouped by who you owe it to.
  const owedByReseller = new Map<string, { name: string; cents: number }>();
  for (const order of owedRows) {
    if (!order.reseller) continue;
    const row = owedByReseller.get(order.reseller.id) ?? {
      name: order.reseller.name,
      cents: 0,
    };
    row.cents += order.resellerCutCents;
    owedByReseller.set(order.reseller.id, row);
  }

  // A worked example on a typical pair, so the split is concrete.
  const example = splitBreakdown(6500, 2300, user.commissionBps);

  return (
    <>
      <h1>Network</h1>

      {user.isReseller && user.handle ? (
        <>
          <h2>Your link</h2>
          <div className="card">
            <p className="mono" style={{ wordBreak: "break-all", fontSize: "1.05rem" }}>
              {appUrl}/r/{user.handle}
            </p>
            <p className="small muted">
              Anyone who opens this and buys within 30 days earns you{" "}
              {formatBps(user.commissionBps)} of the margin — you never touch
              the shoe or the money. Put it in your bio, on a card, in a DM.
            </p>
          </div>

          <h2>What you make</h2>
          <div className="card">
            <p className="small">
              There are two ways to earn, and they pay the same:
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>On a {formatCents(example.listCents)} pair</th>
                    <th className="right">You get</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Share your link</strong>
                      <div className="tiny">
                        They buy on the shop. Owner ships it.
                      </div>
                    </td>
                    <td className="right num">
                      {formatCents(example.commissionCents)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Buy it yourself</strong>
                      <div className="tiny">
                        You pay {formatCents(example.resellerPriceCents)}, sell it
                        at whatever you like.
                      </div>
                    </td>
                    <td className="right num">
                      {formatCents(example.resellerMarginCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="tiny" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
              Sharing the link is less work and carries no risk. Buying outright
              means you set the price and keep anything above it — but it&apos;s
              your money tied up if it doesn&apos;t sell.
            </p>
          </div>

          <h2>Your sales</h2>
          {myReferrals.length === 0 ? (
            <Empty title="Nothing yet">
              Share your link and referred sales land here.
            </Empty>
          ) : (
            <>
              <p className="small">
                <strong>{formatCents(earned)}</strong> earned across{" "}
                {myReferrals.length}{" "}
                {myReferrals.length === 1 ? "sale" : "sales"}.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Status</th>
                      <th className="right">Sold for</th>
                      <th className="right">Your cut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myReferrals.map((order) => (
                      <tr key={order.id}>
                        <td>{shoeName(order.item.shoe)}</td>
                        <td className="small">{order.status}</td>
                        <td className="right num">
                          {formatCents(order.subtotalCents)}
                        </td>
                        <td className="right num">
                          {formatCents(order.resellerCutCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <Notice kind="info" title="You're not set up as a reseller yet">
          <span className="small">
            {user.role === "ADMIN"
              ? "Give yourself a handle on the Sellers page to get your own link."
              : "Ask the shop owner to switch it on and give you a handle."}
          </span>
        </Notice>
      )}

      {owedByReseller.size > 0 ? (
        <>
          <h2>What you owe</h2>
          <Notice kind="warn" title="Pay these out yourself">
            <span className="small">
              Commission is tracked here but not moved by Stripe — the card
              payment goes to you in full. Send each person their cut however
              you normally would.
            </span>
          </Notice>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reseller</th>
                  <th className="right">Owed</th>
                </tr>
              </thead>
              <tbody>
                {[...owedByReseller.entries()].map(([id, row]) => (
                  <tr key={id}>
                    <td>{row.name}</td>
                    <td className="right num">
                      <strong>{formatCents(row.cents)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {user.role === "ADMIN" ? (
        <>
          <h2>Your resellers</h2>
          {resellers.length === 0 ? (
            <Empty
              title="Nobody in the network yet"
              action={{ href: "/app/sellers", label: "Invite someone" }}
            >
              A reseller gets a link, earns a share of the margin, and never
              has to hold stock.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Link</th>
                    <th className="right">Their cut</th>
                    <th className="right">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {resellers.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="mono tiny">/r/{r.handle}</td>
                      <td className="right num">{formatBps(r.commissionBps)}</td>
                      <td className="right num">{r._count.referredOrders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small">
            <Link href="/app/sellers">Manage handles and splits →</Link>
          </p>
        </>
      ) : null}
    </>
  );
}

import Link from "next/link";
import { Empty, Notice, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatSize } from "@/lib/constants";
import { canTakePayments, featureStatuses } from "@/lib/config";
import { shoeName } from "@/lib/research";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const mine = { sellerId: user.id };

  const [
    inHand,
    listed,
    inRestoration,
    soldItems,
    paidOrders,
    newRequests,
    alerts,
    recent,
  ] = await Promise.all([
    prisma.inventoryItem.count({ where: { ...mine, status: "IN_HAND" } }),
    prisma.inventoryItem.count({ where: { ...mine, status: "LISTED" } }),
    prisma.inventoryItem.count({ where: { ...mine, status: "IN_RESTORATION" } }),
    prisma.inventoryItem.findMany({
      where: { ...mine, status: "SOLD" },
      select: { costCents: true, listPriceCents: true },
    }),
    prisma.order.count({ where: { ...mine, status: "PAID" } }),
    prisma.restorationRequest.count({ where: { status: "NEW" } }),
    prisma.sizeAlert.count({ where: { notifiedAt: null } }),
    prisma.inventoryItem.findMany({
      where: mine,
      include: { shoe: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  const tiedUp = await prisma.inventoryItem.aggregate({
    where: { ...mine, status: { in: ["IN_HAND", "IN_RESTORATION", "LISTED"] } },
    _sum: { costCents: true },
  });

  const grossOnSold = soldItems.reduce(
    (sum, i) => sum + ((i.listPriceCents ?? 0) - i.costCents),
    0,
  );

  const off = featureStatuses().filter((f) => !f.on);

  return (
    <>
      <h1>Hey {user.name.split(" ")[0]}</h1>

      {off.length > 0 ? (
        <Notice kind="info" title="Some things are still switched off">
          <span className="small">
            {off.map((f) => f.name).join(", ")}. Everything else works.{" "}
            <Link href="/app/settings#features">See what's needed</Link>
          </span>
        </Notice>
      ) : null}

      {paidOrders > 0 ? (
        <Notice kind="warn" title={`${paidOrders} paid, waiting to ship`}>
          <span className="small">
            <Link href="/app/orders">Get them out the door</Link>
          </span>
        </Notice>
      ) : null}

      <h2>Where you stand</h2>
      <div className="grid">
        <div className="card">
          <div className="tiny">In hand, not listed</div>
          <div className="lane-max">{inHand}</div>
          <div className="tiny">pairs sitting idle</div>
        </div>
        <div className="card">
          <div className="tiny">Listed</div>
          <div className="lane-max">{listed}</div>
          <div className="tiny">live on the shop</div>
        </div>
        <div className="card">
          <div className="tiny">In restoration</div>
          <div className="lane-max">{inRestoration}</div>
          <div className="tiny">being worked on</div>
        </div>
        <div className="card">
          <div className="tiny">Money tied up</div>
          <div className="lane-max">
            {formatCents(tiedUp._sum.costCents ?? 0)}
          </div>
          <div className="tiny">cost of unsold stock</div>
        </div>
        <div className="card">
          <div className="tiny">Sold, all time</div>
          <div className="lane-max">{soldItems.length}</div>
          <div className="tiny">
            {grossOnSold > 0
              ? `${formatCents(grossOnSold)} over cost`
              : "before fees and shipping"}
          </div>
        </div>
        <div className="card">
          <div className="tiny">People waiting</div>
          <div className="lane-max">{alerts}</div>
          <div className="tiny">
            <Link href="/app/leads">size alerts to answer</Link>
          </div>
        </div>
      </div>

      {newRequests > 0 ? (
        <Notice kind="good" title={`${newRequests} restoration enquiry waiting`}>
          <span className="small">
            Someone wants to pay you for the skill, not the shoes.{" "}
            <Link href="/app/leads#requests">Take a look</Link>
          </span>
        </Notice>
      ) : null}

      <h2>Do something</h2>
      <div className="row">
        <Link className="btn btn-primary" href="/app/price">
          Price a pair
        </Link>
        <Link className="btn" href="/app/inventory">
          Inventory
        </Link>
        <Link className="btn btn-ghost" href="/app/playbook">
          Marketing playbook
        </Link>
        <Link className="btn btn-ghost" href="/app/guide">
          How this works
        </Link>
      </div>

      <h2>Recently touched</h2>
      {recent.length === 0 ? (
        <Empty
          title="Nothing in here yet"
          action={{ href: "/app/price", label: "Price your first pair" }}
        >
          Photograph a pair and the app will tell you the most you should pay
          for it.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pair</th>
                <th>Size</th>
                <th>Status</th>
                <th className="right">Paid</th>
                <th className="right">Asking</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/app/inventory/${item.id}`}>
                      {shoeName(item.shoe)}
                    </Link>
                  </td>
                  <td>{formatSize(item.size, item.sizeType)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="right num">{formatCents(item.costCents)}</td>
                  <td className="right num">
                    {formatCents(item.listPriceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!canTakePayments() ? (
        <p className="tiny" style={{ marginTop: "2rem" }}>
          Card checkout is off, so the shop shows a "Message to buy" button.
          That's a fine way to run for a while — plenty of resellers never turn
          it on.
        </p>
      ) : null}
    </>
  );
}

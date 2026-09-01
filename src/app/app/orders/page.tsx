import Link from "next/link";
import { Empty, Field, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatSize, orderStatusLabel } from "@/lib/constants";
import { canTakePayments, hasStripeWebhook } from "@/lib/config";
import { shoeName } from "@/lib/research";
import { markShippedAction } from "../actions";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ shipped?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();

  const orders = await prisma.order.findMany({
    where: user.role === "ADMIN" ? {} : { sellerId: user.id },
    include: {
      item: { include: { shoe: true } },
      seller: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const toShip = orders.filter((o) => o.status === "PAID");

  return (
    <>
      <h1>Orders</h1>

      {sp.shipped ? <Notice kind="good">Marked as shipped.</Notice> : null}

      {!canTakePayments() ? (
        <Notice kind="info" title="Card checkout isn't on yet">
          <span className="small">
            {hasStripeWebhook
              ? "Stripe keys are missing."
              : "Payments can't be confirmed without a webhook secret, so orders would sit at 'awaiting payment' forever."}{" "}
            <Link href="/app/settings#features">What's needed</Link>
          </span>
        </Notice>
      ) : null}

      {toShip.length > 0 ? (
        <>
          <h2>Paid — get these out</h2>
          <div className="stack">
            {toShip.map((order) => (
              <div className="card" key={order.id}>
                <div className="spread">
                  <div>
                    <strong>{shoeName(order.item.shoe)}</strong>
                    <div className="small muted">
                      {formatSize(order.item.size, order.item.sizeType)} ·{" "}
                      {formatCents(order.totalCents)} · {order.ref}
                    </div>
                  </div>
                  <span className="badge badge-warn">Needs shipping</span>
                </div>

                <div className="small" style={{ marginTop: "0.6rem" }}>
                  <strong>{order.buyerName || order.buyerEmail}</strong>
                  <br />
                  {order.shipLine1 ? (
                    <>
                      {order.shipLine1}
                      {order.shipLine2 ? `, ${order.shipLine2}` : ""}
                      <br />
                      {order.shipCity}, {order.shipState} {order.shipPostal}
                    </>
                  ) : (
                    <span className="muted">No address on this order.</span>
                  )}
                  <br />
                  <span className="muted">{order.buyerEmail}</span>
                </div>

                <form action={markShippedAction} style={{ marginTop: "0.8rem" }}>
                  <input type="hidden" name="id" value={order.id} />
                  <div className="cols-2">
                    <Field label="Carrier">
                      <input name="trackingCarrier" placeholder="USPS" />
                    </Field>
                    <Field label="Tracking number">
                      <input name="trackingNumber" placeholder="9400…" />
                    </Field>
                  </div>
                  <button className="btn btn-primary" type="submit">
                    Mark shipped
                  </button>
                </form>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2>Everything</h2>
      {orders.length === 0 ? (
        <Empty title="No orders yet">
          Orders land here the moment someone pays through the shop.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Pair</th>
                <th>Buyer</th>
                <th>Status</th>
                {user.role === "ADMIN" ? <th>Seller</th> : null}
                <th className="right">Total</th>
                <th className="right">Your cut</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="mono tiny">{order.ref}</td>
                  <td>
                    <Link href={`/app/inventory/${order.itemId}`}>
                      {shoeName(order.item.shoe)}
                    </Link>
                  </td>
                  <td className="small">
                    {order.buyerName || order.buyerEmail || "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        order.status === "PAID"
                          ? "badge-warn"
                          : order.status === "SHIPPED"
                            ? "badge-good"
                            : order.status === "REFUNDED" ||
                                order.status === "CANCELLED"
                              ? "badge-bad"
                              : ""
                      }`}
                    >
                      {orderStatusLabel(order.status)}
                    </span>
                    {order.trackingNumber ? (
                      <div className="tiny mono">{order.trackingNumber}</div>
                    ) : null}
                  </td>
                  {user.role === "ADMIN" ? (
                    <td className="small">{order.seller.name}</td>
                  ) : null}
                  <td className="right num">{formatCents(order.totalCents)}</td>
                  <td className="right num">
                    {formatCents(order.totalCents - order.platformFeeCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

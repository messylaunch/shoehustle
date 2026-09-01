import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { Notice } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatSize } from "@/lib/constants";
import { shoeName } from "@/lib/research";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const settings = await getSettings();

  const order = ref
    ? await prisma.order.findUnique({
        where: { ref },
        include: { item: { include: { shoe: true } } },
      })
    : null;

  return (
    <PublicShell>
      <h1>You're all set</h1>

      {order ? (
        <>
          <Notice kind="good" title="Payment went through">
            Your order reference is <strong>{order.ref}</strong>. Keep it handy
            if you need to get in touch.
          </Notice>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>{shoeName(order.item.shoe)}</h3>
            <p className="small muted">
              {formatSize(order.item.size, order.item.sizeType)}
            </p>
            <div className="table-wrap" style={{ marginTop: "0.8rem" }}>
              <table>
                <tbody>
                  <tr>
                    <td>Pair</td>
                    <td className="right num">
                      {formatCents(order.subtotalCents)}
                    </td>
                  </tr>
                  <tr>
                    <td>Shipping</td>
                    <td className="right num">
                      {formatCents(order.shippingCents)}
                    </td>
                  </tr>
                  {order.taxCents > 0 ? (
                    <tr>
                      <td>Tax</td>
                      <td className="right num">
                        {formatCents(order.taxCents)}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td className="right num">
                      <strong>{formatCents(order.totalCents)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="small">
            {order.status === "PAID" || order.status === "SHIPPED"
              ? "I'll get these packed and send you tracking as soon as they're on their way."
              : "Payment is still settling. If this doesn't update in a few minutes, message me with your reference and I'll sort it."}
          </p>
        </>
      ) : (
        <Notice kind="info" title="Thanks">
          If you just paid, you'll get an email receipt from Stripe. Message me
          if anything looks off.
        </Notice>
      )}

      <p className="small muted">{settings.contactLine}</p>

      <p>
        <Link className="btn" href="/">
          Keep looking
        </Link>
      </p>
    </PublicShell>
  );
}

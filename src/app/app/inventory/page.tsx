import Link from "next/link";
import { Empty, GradeBadge, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { formatSize, ITEM_STATUSES } from "@/lib/constants";
import { shoeName } from "@/lib/research";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; size?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();

  const items = await prisma.inventoryItem.findMany({
    where: {
      // Admins see the whole operation; a seller sees their own pairs.
      ...(user.role === "ADMIN" ? {} : { sellerId: user.id }),
      ...(sp.status ? { status: sp.status } : {}),
      ...(sp.size ? { size: sp.size } : {}),
      ...(sp.q
        ? {
            shoe: {
              OR: [
                { brand: { contains: sp.q } },
                { model: { contains: sp.q } },
                { colorway: { contains: sp.q } },
                { styleCode: { contains: sp.q } },
              ],
            },
          }
        : {}),
    },
    include: { shoe: true, seller: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const counts = await prisma.inventoryItem.groupBy({
    by: ["status"],
    where: user.role === "ADMIN" ? {} : { sellerId: user.id },
    _count: true,
  });
  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count ?? 0;

  return (
    <>
      <div className="spread">
        <h1>Inventory</h1>
        <Link className="btn btn-primary" href="/app/price">
          Add a pair
        </Link>
      </div>

      <div className="size-filter" style={{ marginBottom: "1rem" }}>
        <Link href="/app/inventory" className={`size-chip ${sp.status ? "" : "on"}`}>
          All ({counts.reduce((sum, c) => sum + c._count, 0)})
        </Link>
        {ITEM_STATUSES.map((s) => (
          <Link
            key={s.code}
            href={`/app/inventory?status=${s.code}`}
            className={`size-chip ${sp.status === s.code ? "on" : ""}`}
          >
            {s.label} ({countFor(s.code)})
          </Link>
        ))}
      </div>

      <form method="get" className="row" style={{ marginBottom: "1rem" }}>
        {sp.status ? (
          <input type="hidden" name="status" value={sp.status} />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search brand, model, colorway or style code"
          style={{ flex: 1, minWidth: "200px" }}
        />
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      {items.length === 0 ? (
        <Empty
          title="Nothing here"
          action={{ href: "/app/price", label: "Price a pair" }}
        >
          {sp.status || sp.q
            ? "Nothing matches that filter."
            : "Photograph a pair and it'll show up here."}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pair</th>
                <th>Size</th>
                <th>Grade</th>
                <th>Status</th>
                {user.role === "ADMIN" ? <th>Seller</th> : null}
                <th className="right">Paid</th>
                <th className="right">Asking</th>
                <th className="right">Spread</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const spread =
                  item.listPriceCents !== null
                    ? item.listPriceCents - item.costCents
                    : null;
                return (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/app/inventory/${item.id}`}>
                        {shoeName(item.shoe)}
                      </Link>
                      {item.shoe.styleCode ? (
                        <div className="tiny mono">{item.shoe.styleCode}</div>
                      ) : null}
                    </td>
                    <td className="num">
                      {formatSize(item.size, item.sizeType)}
                    </td>
                    <td>
                      <GradeBadge grade={item.grade} />
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    {user.role === "ADMIN" ? (
                      <td className="small">{item.seller.name}</td>
                    ) : null}
                    <td className="right num">{formatCents(item.costCents)}</td>
                    <td className="right num">
                      {formatCents(item.listPriceCents)}
                    </td>
                    <td className="right num">
                      {spread === null ? (
                        "—"
                      ) : (
                        <span
                          style={{
                            color:
                              spread > 0 ? "var(--good)" : "var(--bad)",
                            fontWeight: 600,
                          }}
                        >
                          {formatCents(spread)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="tiny" style={{ marginTop: "1rem" }}>
        Spread is asking price minus what you paid — before fees, shipping and
        restoration. Open a pair to see what you'd actually clear.
      </p>
    </>
  );
}

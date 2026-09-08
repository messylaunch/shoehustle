import { Empty, Field, Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { formatBps } from "@/lib/money";
import {
  inviteSellerAction,
  revokeInviteAction,
  setResellerAction,
  setSellerFeeAction,
  toggleSellerActiveAction,
} from "../actions";

export const metadata = { title: "Sellers" };
export const dynamic = "force-dynamic";

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();

  const [sellers, invites] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { items: true, orders: true } } },
    }),
    prisma.invite.findMany({
      where: { usedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <h1>Sellers</h1>
      <p className="muted prose">
        Everyone here lists on the same shop. Each one sets up their own Stripe
        payouts, and your cut comes off their sales automatically.
      </p>

      {sp.invited ? (
        <Notice kind="good" title="Invite created">
          Send them the link below. It works once.
        </Notice>
      ) : null}
      {sp.saved ? <Notice kind="good">Saved.</Notice> : null}
      {sp.error === "exists" ? (
        <Notice kind="bad">There's already an account on that email.</Notice>
      ) : null}
      {sp.error === "self" ? (
        <Notice kind="bad">You can't switch off your own account.</Notice>
      ) : null}
      {sp.error === "missing" ? (
        <Notice kind="bad">An invite needs a name and an email.</Notice>
      ) : null}
      {sp.error === "handle" ? (
        <Notice kind="bad">
          A reseller needs a handle — letters, numbers and dashes, at least two
          characters. It goes in their link.
        </Notice>
      ) : null}
      {sp.error === "handletaken" ? (
        <Notice kind="bad">Somebody already has that handle.</Notice>
      ) : null}

      <h2>People selling</h2>
      <div className="stack">
        {sellers.map((seller) => (
          <div className="card" key={seller.id}>
            <div className="spread">
              <div>
                <strong>{seller.name}</strong>
                {seller.role === "ADMIN" ? (
                  <span className="badge badge-info" style={{ marginLeft: "0.4rem" }}>
                    admin
                  </span>
                ) : null}
                {!seller.active ? (
                  <span className="badge badge-bad" style={{ marginLeft: "0.4rem" }}>
                    switched off
                  </span>
                ) : null}
                <div className="small muted">{seller.email}</div>
                <div className="tiny">
                  {seller._count.items} pairs · {seller._count.orders} orders ·{" "}
                  {seller.stripeReady ? (
                    <span style={{ color: "var(--good)" }}>can be paid</span>
                  ) : (
                    <span style={{ color: "var(--warn)" }}>
                      hasn't finished Stripe
                    </span>
                  )}
                </div>
              </div>
              <span className="badge">
                your cut {formatBps(seller.platformFeeBps)}
              </span>
            </div>

            <form action={setResellerAction} style={{ marginTop: "0.7rem" }}>
              <input type="hidden" name="id" value={seller.id} />
              <label className="small" style={{ fontWeight: 400 }}>
                <input
                  type="checkbox"
                  name="isReseller"
                  defaultChecked={seller.isReseller}
                  style={{ width: "auto", marginRight: "0.4rem" }}
                />
                Can resell — gets their own link and earns a share
              </label>
              <div className="cols-2" style={{ marginTop: "0.5rem" }}>
                <Field label="Handle" hint="Their link: /r/handle">
                  <input
                    name="handle"
                    defaultValue={seller.handle ?? ""}
                    placeholder="josh"
                  />
                </Field>
                <Field label="Their share of the margin">
                  <input
                    name="commissionPercent"
                    inputMode="decimal"
                    defaultValue={(seller.commissionBps / 100).toString()}
                    placeholder="30"
                  />
                </Field>
              </div>
              <button className="btn btn-small" type="submit">
                Save reseller settings
              </button>
            </form>

            <div className="row" style={{ marginTop: "0.7rem" }}>
              <form action={setSellerFeeAction} className="row">
                <input type="hidden" name="id" value={seller.id} />
                <input
                  name="feePercent"
                  inputMode="decimal"
                  defaultValue={(seller.platformFeeBps / 100).toString()}
                  style={{ width: "5rem" }}
                  aria-label={`Platform fee for ${seller.name}`}
                />
                <span className="small">%</span>
                <button className="btn btn-small" type="submit">
                  Set cut
                </button>
              </form>

              {seller.id !== admin.id ? (
                <form action={toggleSellerActiveAction}>
                  <input type="hidden" name="id" value={seller.id} />
                  <button
                    className={`btn btn-small ${seller.active ? "btn-danger" : ""}`}
                    type="submit"
                  >
                    {seller.active ? "Switch off" : "Switch back on"}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <h2>Invite someone</h2>
      <div className="card">
        <p className="small muted">
          Before you send this, know what they're signing up for: they'll have
          to give Stripe their legal name, SSN or EIN and a bank account before
          they can be paid. Worth mentioning up front rather than halfway
          through.
        </p>
        <form action={inviteSellerAction}>
          <div className="cols-2">
            <Field label="Their name">
              <input name="name" required placeholder="Josh" />
            </Field>
            <Field label="Their email">
              <input name="email" type="email" required />
            </Field>
          </div>
          <button className="btn btn-primary" type="submit">
            Create invite
          </button>
        </form>
      </div>

      <h2>Invites waiting</h2>
      {invites.length === 0 ? (
        <Empty title="No open invites">
          Everyone you've invited has signed up.
        </Empty>
      ) : (
        <div className="stack">
          {invites.map((invite) => (
            <div className="card" key={invite.id}>
              <div className="spread">
                <div>
                  <strong>{invite.name}</strong>
                  <div className="small muted">{invite.email}</div>
                </div>
                <span className="tiny">
                  {invite.createdAt.toLocaleDateString("en-US")}
                </span>
              </div>
              <p className="small mono" style={{ wordBreak: "break-all" }}>
                {appUrl}/join?code={invite.code}
              </p>
              <form action={revokeInviteAction}>
                <input type="hidden" name="id" value={invite.id} />
                <button className="btn btn-small btn-danger" type="submit">
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import { Empty, Field, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { centsToInput, formatCents } from "@/lib/money";
import { REQUEST_STATUSES, requestStatusLabel } from "@/lib/constants";
import { markAlertNotifiedAction, updateRequestAction } from "../actions";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

// Size alerts and restoration enquiries. This is the list nobody can throttle,
// which is the whole argument for having your own storefront.

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  await requireUser();

  const [alerts, requests, inStock] = await Promise.all([
    prisma.sizeAlert.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.restorationRequest.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.inventoryItem.findMany({
      where: { status: "LISTED" },
      select: { size: true },
    }),
  ]);

  const stockedSizes = new Set(inStock.map((i) => i.size));
  const waiting = alerts.filter((a) => !a.notifiedAt);
  // Someone waiting on a size you now have is a sale sitting there unclaimed.
  const matchable = waiting.filter((a) => stockedSizes.has(a.size));

  return (
    <>
      <h1>Leads</h1>
      {sp.saved ? <Notice kind="good">Saved.</Notice> : null}

      {matchable.length > 0 ? (
        <Notice
          kind="good"
          title={`${matchable.length} ${matchable.length === 1 ? "person is" : "people are"} waiting on a size you have in stock`}
        >
          <span className="small">
            {matchable.map((a) => `${a.email} (${a.size})`).join(", ")}. Message
            them today — this is the easiest sale you'll make all week.
          </span>
        </Notice>
      ) : null}

      <h2 id="alerts">Size alerts ({waiting.length} waiting)</h2>
      {alerts.length === 0 ? (
        <Empty title="Nobody on the list yet">
          Every visitor whose size you don't have is a lead you're currently
          losing. The form is already on your shop page — drive people to it.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Size</th>
                <th>Hunting for</th>
                <th>Asked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="small">{alert.email}</td>
                  <td className="num">
                    {alert.size}
                    {stockedSizes.has(alert.size) && !alert.notifiedAt ? (
                      <span
                        className="badge badge-good"
                        style={{ marginLeft: "0.3rem" }}
                      >
                        in stock
                      </span>
                    ) : null}
                  </td>
                  <td className="small muted">{alert.note ?? "—"}</td>
                  <td className="tiny">
                    {alert.createdAt.toLocaleDateString("en-US")}
                  </td>
                  <td className="right">
                    {alert.notifiedAt ? (
                      <span className="tiny">
                        messaged{" "}
                        {alert.notifiedAt.toLocaleDateString("en-US")}
                      </span>
                    ) : (
                      <form action={markAlertNotifiedAction}>
                        <input type="hidden" name="id" value={alert.id} />
                        <button className="btn btn-small" type="submit">
                          Mark messaged
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 id="requests">Restoration enquiries</h2>
      {requests.length === 0 ? (
        <Empty title="No enquiries yet">
          These are people paying for your skill rather than your stock. Post a
          before-and-after and point it at your restoration page.
        </Empty>
      ) : (
        <div className="stack">
          {requests.map((request) => (
            <div className="card" key={request.id}>
              <div className="spread">
                <div>
                  <strong>{request.shoeDescription}</strong>
                  <div className="small muted">
                    {request.name} · {request.email}
                    {request.phone ? ` · ${request.phone}` : ""}
                  </div>
                </div>
                <span
                  className={`badge ${
                    request.status === "NEW"
                      ? "badge-warn"
                      : request.status === "DONE"
                        ? "badge-good"
                        : ""
                  }`}
                >
                  {requestStatusLabel(request.status)}
                </span>
              </div>

              {request.condition ? (
                <p className="small" style={{ marginTop: "0.5rem" }}>
                  {request.condition}
                </p>
              ) : null}

              {request.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={request.photoUrl}
                  alt=""
                  style={{
                    maxWidth: "260px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                  }}
                />
              ) : null}

              <form action={updateRequestAction} style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="id" value={request.id} />
                <div className="cols-2">
                  <Field label="Status">
                    <select name="status" defaultValue={request.status}>
                      {REQUEST_STATUSES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Your quote">
                    <input
                      name="quote"
                      inputMode="decimal"
                      defaultValue={centsToInput(request.quoteCents)}
                      placeholder="45.00"
                    />
                  </Field>
                </div>
                <Field label="Ready by">
                  <input
                    type="date"
                    name="etaDate"
                    defaultValue={
                      request.etaDate
                        ? request.etaDate.toISOString().slice(0, 10)
                        : ""
                    }
                  />
                </Field>
                <Field label="Notes to yourself">
                  <textarea
                    name="internalNotes"
                    defaultValue={request.internalNotes ?? ""}
                  />
                </Field>
                <button className="btn" type="submit">
                  Save
                </button>
              </form>

              <div className="tiny" style={{ marginTop: "0.5rem" }}>
                Came in {request.createdAt.toLocaleDateString("en-US")}
                {request.quoteCents
                  ? ` · quoted ${formatCents(request.quoteCents)}`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import { Empty, Field, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DAYS, formatMeet } from "@/lib/pickup";
import { deletePickupAction, savePickupAction } from "../actions";

export const metadata = { title: "Pickup meets" };
export const dynamic = "force-dynamic";

// Same place, same time, every week. That regularity is the product — it's
// what turns "some guy online" into "the shoe guy who's at the lot on
// Saturdays".

export default async function PickupsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; retired?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();

  const spots = await prisma.pickupLocation.findMany({
    where: user.role === "ADMIN" ? {} : { holderId: user.id },
    include: {
      holder: { select: { name: true } },
      _count: { select: { orders: true } },
    },
    orderBy: [{ active: "desc" }, { dayOfWeek: "asc" }],
  });

  return (
    <>
      <h1>Pickup meets</h1>
      <p className="muted prose">
        Where and when you hand shoes over. Keep it to one or two spots at the
        same time every week — predictability is what makes people plan around
        you instead of asking every time.
      </p>

      {sp.saved ? <Notice kind="good">Saved.</Notice> : null}
      {sp.retired ? (
        <Notice kind="warn">
          That spot has orders against it, so it&apos;s been switched off rather
          than deleted. The history stays intact.
        </Notice>
      ) : null}
      {sp.error === "missing" ? (
        <Notice kind="bad">A meet needs a name, an address and a town.</Notice>
      ) : null}

      <Notice kind="info" title="Everything is paid before the meet">
        <span className="small">
          Nobody stands in a parking lot counting cash, and the person handing
          over never carries money. If a buyer turns up wanting to pay there,
          they buy it on their phone first — that&apos;s the rule that keeps
          this safe for whoever&apos;s doing the handover.
        </span>
      </Notice>

      <h2>Your spots</h2>
      {spots.length === 0 ? (
        <Empty title="No meets set up yet">
          Add one below and it shows on the shop so buyers can choose pickup at
          checkout.
        </Empty>
      ) : (
        <div className="stack">
          {spots.map((spot) => (
            <div className="card" key={spot.id}>
              <form action={savePickupAction}>
                <input type="hidden" name="id" value={spot.id} />
                <div className="spread">
                  <strong>{formatMeet(spot)}</strong>
                  <span className={`badge ${spot.active ? "badge-good" : ""}`}>
                    {spot.active ? "live" : "off"}
                  </span>
                </div>
                <div className="tiny" style={{ marginBottom: "0.7rem" }}>
                  {spot._count.orders} order
                  {spot._count.orders === 1 ? "" : "s"} collected here
                  {user.role === "ADMIN" && spot.holder
                    ? ` · run by ${spot.holder.name}`
                    : ""}
                </div>

                <div className="cols-2">
                  <Field label="Name">
                    <input name="name" defaultValue={spot.name} required />
                  </Field>
                  <Field label="Town">
                    <input name="city" defaultValue={spot.city} required />
                  </Field>
                </div>
                <Field
                  label="Address"
                  hint="Somewhere public and well lit. A supermarket lot beats a side street."
                >
                  <input name="address" defaultValue={spot.address} required />
                </Field>
                <div className="cols-2">
                  <Field label="Day">
                    <select name="dayOfWeek" defaultValue={String(spot.dayOfWeek)}>
                      {DAYS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="field">
                    <label>
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={spot.active}
                        style={{ width: "auto", marginRight: "0.4rem" }}
                      />
                      Running
                    </label>
                  </div>
                </div>
                <div className="cols-2">
                  <Field label="From">
                    <input type="time" name="startTime" defaultValue={spot.startTime} />
                  </Field>
                  <Field label="Until">
                    <input type="time" name="endTime" defaultValue={spot.endTime} />
                  </Field>
                </div>
                <Field label="Anything buyers should know">
                  <input
                    name="notes"
                    defaultValue={spot.notes ?? ""}
                    placeholder="Round the back by the loading bay — look for the black truck"
                  />
                </Field>
                <button className="btn btn-small" type="submit">
                  Save
                </button>
              </form>

              <form action={deletePickupAction} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="id" value={spot.id} />
                <button className="btn btn-small btn-danger" type="submit">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <h2>Add a meet</h2>
      <div className="card">
        <form action={savePickupAction}>
          <div className="cols-2">
            <Field label="Name">
              <input name="name" required placeholder="Saturday lot" />
            </Field>
            <Field label="Town">
              <input name="city" required />
            </Field>
          </div>
          <Field
            label="Address"
            hint="Public, well lit, easy to find. Safety matters more than convenience."
          >
            <input name="address" required placeholder="Kroger parking lot, 4th & Main" />
          </Field>
          <div className="cols-2">
            <Field label="Day">
              <select name="dayOfWeek" defaultValue="6">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked
                  style={{ width: "auto", marginRight: "0.4rem" }}
                />
                Running
              </label>
            </div>
          </div>
          <div className="cols-2">
            <Field label="From">
              <input type="time" name="startTime" defaultValue="12:00" />
            </Field>
            <Field label="Until">
              <input type="time" name="endTime" defaultValue="14:00" />
            </Field>
          </div>
          <Field label="Anything buyers should know">
            <input name="notes" placeholder="Look for the black truck" />
          </Field>
          <button className="btn btn-primary" type="submit">
            Add meet
          </button>
        </form>
      </div>

      <h2>Running a meet</h2>
      <div className="card prose small">
        <ul className="tight" style={{ marginBottom: 0 }}>
          <li>
            <strong>Everything is prepaid.</strong> No money changes hands at
            the meet. Whoever hands over never carries cash.
          </li>
          <li>
            <strong>Bring the listing.</strong> Open the shoe&apos;s page on your
            phone. If someone says it isn&apos;t as described, the grade card and
            the flaw list are right there — and the photos were taken before
            they bought it.
          </li>
          <li>
            <strong>Public and busy beats quiet and convenient.</strong> A
            supermarket lot in daylight, not a side street after dark.
          </li>
          <li>
            <strong>Same slot every week, even a quiet one.</strong> Skipping
            because only one person is coming is how people stop trusting the
            schedule.
          </li>
          <li>
            <strong>Bring two or three unsold pairs</strong> in common sizes.
            People who come for one pair buy two more surprisingly often.
          </li>
        </ul>
      </div>
    </>
  );
}

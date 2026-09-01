import Link from "next/link";
import { notFound } from "next/navigation";
import { Field, GradeBadge, Money, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { centsToInput, formatBps, formatCents } from "@/lib/money";
import {
  COMP_SOURCES,
  GRADES,
  ITEM_STATUSES,
  SIZE_TYPES,
  compSourceLabel,
  gradeByCode,
} from "@/lib/constants";
import {
  bestLane,
  buildLanes,
  estimateSellPrice,
  profitCents,
  roiPercent,
  verdictFor,
} from "@/lib/pricing";
import { referenceImagesLink, researchLinks, shoeName } from "@/lib/research";
import {
  addCompAction,
  addPhotosAction,
  deleteCompAction,
  deleteItemAction,
  deletePhotoAction,
  saveEstimatesAction,
  updateItemAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ channel?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      shoe: true,
      photos: { orderBy: { sort: "asc" } },
      comps: { orderBy: { capturedAt: "desc" } },
      seller: true,
    },
  });

  if (!item) notFound();
  if (item.sellerId !== user.id && user.role !== "ADMIN") notFound();

  const channels = await prisma.channel.findMany({
    where: { userId: item.sellerId },
    orderBy: { sortOrder: "asc" },
  });

  const activeChannel =
    channels.find((c) => c.id === sp.channel) ??
    channels.find((c) => c.isDefault) ??
    channels[0];

  const fee = activeChannel
    ? { feeBps: activeChannel.feeBps, fixedFeeCents: activeChannel.fixedFeeCents }
    : { feeBps: 0, fixedFeeCents: 0 };

  // Estimate from comps unless you've overridden it by hand.
  const estimate = estimateSellPrice(item.comps, item.grade, item.shoe.retailCents);
  const asIs = item.estAsIsCents ?? estimate.cents;

  const lanes = buildLanes({
    asIsCents: asIs,
    cleanCents: item.estCleanCents,
    restoredCents: item.estRestoredCents,
    grade: item.grade,
    fee,
    shipOutCents: item.seller.shipOutCents,
    cleanCostCents: item.seller.cleanCostCents,
    restoreCostCents: item.seller.restoreCostCents,
    targetProfitCents: item.seller.targetProfitCents,
  });

  const best = bestLane(lanes);
  const verdict = verdictFor(item.costCents > 0 ? item.costCents : null, lanes);
  const grade = gradeByCode(item.grade);
  const links = researchLinks(item.shoe, { size: item.size });

  const actualProfit =
    best && best.sellCents !== null && item.costCents > 0
      ? profitCents(best.sellCents, item.costCents, fee, {
          shipOutCents: item.seller.shipOutCents,
          reconditionCents: best.reconditionCents,
        })
      : null;
  const actualRoi =
    best && best.sellCents !== null && item.costCents > 0
      ? roiPercent(best.sellCents, item.costCents, fee, {
          shipOutCents: item.seller.shipOutCents,
          reconditionCents: best.reconditionCents,
        })
      : null;

  return (
    <>
      <p className="small">
        <Link href="/app/inventory">← Inventory</Link>
        {" · "}
        <Link href={`/shoe/${item.id}`} target="_blank">
          View public page
        </Link>
      </p>

      <h1>{shoeName(item.shoe)}</h1>
      <div className="row">
        <span className="badge badge-info">
          {item.size} {item.sizeType}
        </span>
        <GradeBadge grade={item.grade} />
        {item.shoe.styleCode ? (
          <span className="badge mono">{item.shoe.styleCode}</span>
        ) : null}
        <span className="badge">Paid {formatCents(item.costCents)}</span>
      </div>

      {sp.saved ? <Notice kind="good">Saved.</Notice> : null}
      {sp.error === "hasorders" ? (
        <Notice kind="bad" title="Can't delete this one">
          Someone has paid for this pair. Cancel or refund the order first.
        </Notice>
      ) : null}
      {sp.error === "price" ? (
        <Notice kind="bad">A comp needs a price above zero.</Notice>
      ) : null}

      {/* ---------------- the verdict ---------------- */}

      <h2>The verdict</h2>

      <div className={`verdict verdict-${verdict.kind}`}>
        <h2>{verdict.headline}</h2>
        <p>{verdict.detail}</p>
      </div>

      {channels.length > 1 ? (
        <div className="row" style={{ marginTop: "0.8rem" }}>
          <span className="small muted">Selling on:</span>
          {channels.map((c) => (
            <Link
              key={c.id}
              href={`/app/inventory/${item.id}?channel=${c.id}`}
              className={`size-chip ${activeChannel?.id === c.id ? "on" : ""}`}
            >
              {c.name} <span className="tiny">{formatBps(c.feeBps)}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid" style={{ marginTop: "1rem" }}>
        {lanes.map((lane) => (
          <div
            key={lane.key}
            className={`lane ${lane.notApplicable ? "na" : ""} ${
              best?.key === lane.key ? "best" : ""
            }`}
          >
            <div className="lane-name">
              {lane.label}
              {best?.key === lane.key ? (
                <span className="badge badge-good">Best</span>
              ) : null}
            </div>
            <div className="lane-max">
              {lane.maxBuyCents === null ? "—" : formatCents(lane.maxBuyCents)}
            </div>
            <div className="tiny">most you should pay</div>
            <hr style={{ margin: "0.6rem 0" }} />
            <div className="small muted">
              {lane.notApplicable ? (
                lane.note
              ) : (
                <>
                  Sells for <Money cents={lane.sellCents} />
                  <br />
                  You net <Money cents={lane.netProceedsCents} /> after fees
                  {lane.reconditionCents > 0 ? (
                    <>
                      <br />
                      Work costs <Money cents={lane.reconditionCents} />
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="notice" style={{ marginTop: "1rem" }}>
        <strong>Where that number comes from</strong>
        <span className="small">{estimate.note}</span>
        {activeChannel ? (
          <div className="small muted" style={{ marginTop: "0.4rem" }}>
            Assuming {activeChannel.name} at {formatBps(activeChannel.feeBps)}
            {activeChannel.fixedFeeCents > 0
              ? ` plus ${formatCents(activeChannel.fixedFeeCents)}`
              : ""}
            , {formatCents(item.seller.shipOutCents)} to ship, and a{" "}
            {formatCents(item.seller.targetProfitCents)} target profit.{" "}
            <Link href="/app/settings">Change these</Link>
          </div>
        ) : (
          <div className="small muted">
            No selling channels set up yet.{" "}
            <Link href="/app/settings">Add one</Link> so fees are accounted for.
          </div>
        )}
      </div>

      {actualProfit !== null ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>If you sell it at that price</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            You paid <strong>{formatCents(item.costCents)}</strong>. On the{" "}
            {best?.label.toLowerCase()} lane you'd clear{" "}
            <strong>{formatCents(actualProfit)}</strong>
            {actualRoi !== null ? (
              <>
                {" "}
                — a <strong>{actualRoi.toFixed(0)}%</strong> return on the{" "}
                {formatCents(
                  item.costCents +
                    (best?.reconditionCents ?? 0) +
                    item.seller.shipOutCents,
                )}{" "}
                you'd have in it.
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* ---------------- research ---------------- */}

      <h2>Look up what it's worth</h2>
      <p className="muted small prose">
        These open the search already filtered. Start with eBay sold prices —
        that's what pairs actually went for, and it's the number worth trusting.
        Then add what you find as a comp below.
      </p>

      <div className="linkgrid">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="linkcard"
          >
            <div className="lc-name">
              {link.label}{" "}
              <span
                className={`badge ${
                  link.kind === "SOLD"
                    ? "badge-good"
                    : link.kind === "ASK"
                      ? "badge-warn"
                      : ""
                }`}
              >
                {link.kind === "SOLD"
                  ? "real sales"
                  : link.kind === "ASK"
                    ? "asks"
                    : "mixed"}
              </span>
            </div>
            <div className="lc-hint">{link.hint}</div>
          </a>
        ))}
        <a
          href={referenceImagesLink(item.shoe)}
          target="_blank"
          rel="noreferrer noopener"
          className="linkcard"
        >
          <div className="lc-name">Reference photos</div>
          <div className="lc-hint">
            Compare your pair against a clean one to sanity-check the grade.
          </div>
        </a>
      </div>

      {/* ---------------- comps ---------------- */}

      <h2 id="comps">Comps</h2>

      {item.comps.length === 0 ? (
        <Notice kind="warn" title="No comps yet">
          Two real sold prices is usually enough to trust the number above.
          Without them you're pricing off a rule of thumb.
        </Notice>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Price</th>
                <th>Type</th>
                <th>Source</th>
                <th>Size</th>
                <th>Grade</th>
                <th>Noted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {item.comps.map((comp) => (
                <tr key={comp.id}>
                  <td className="num">
                    <strong>{formatCents(comp.priceCents)}</strong>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        comp.kind === "SOLD" ? "badge-good" : "badge-warn"
                      }`}
                    >
                      {comp.kind === "SOLD" ? "sold" : "ask"}
                    </span>
                  </td>
                  <td>
                    {comp.url ? (
                      <a href={comp.url} target="_blank" rel="noreferrer noopener">
                        {compSourceLabel(comp.source)}
                      </a>
                    ) : (
                      compSourceLabel(comp.source)
                    )}
                  </td>
                  <td>{comp.size ?? "—"}</td>
                  <td>{comp.grade ?? "—"}</td>
                  <td className="tiny">
                    {comp.capturedAt.toLocaleDateString("en-US")}
                    {comp.note ? <div>{comp.note}</div> : null}
                  </td>
                  <td className="right">
                    <form action={deleteCompAction}>
                      <input type="hidden" name="compId" value={comp.id} />
                      <button className="btn btn-small btn-danger" type="submit">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Add a comp</h3>
        <form action={addCompAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <div className="cols-2">
            <Field label="Price">
              <input name="price" inputMode="decimal" required placeholder="65.00" />
            </Field>
            <Field
              label="Sold or asking?"
              hint="Asks run high. Marking them honestly keeps your estimate honest."
            >
              <select name="kind" defaultValue="SOLD">
                <option value="SOLD">Actually sold</option>
                <option value="ASK">Just an asking price</option>
              </select>
            </Field>
          </div>
          <div className="cols-2">
            <Field label="Source">
              <select name="source" defaultValue="EBAY">
                {COMP_SOURCES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Grade of that pair">
              <select name="grade" defaultValue={item.grade}>
                <option value="">Unknown</option>
                {GRADES.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="cols-2">
            <Field label="Size">
              <input name="size" defaultValue={item.size} />
            </Field>
            <Field label="Link (optional)">
              <input name="url" type="url" placeholder="https://…" />
            </Field>
          </div>
          <Field label="Note (optional)">
            <input name="note" placeholder="Same colorway, box included" />
          </Field>
          <button className="btn btn-primary" type="submit">
            Add comp
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Override the estimates</h3>
        <p className="small muted">
          Leave these blank to let the comps decide. Fill one in when you know
          better than the math.
        </p>
        <form action={saveEstimatesAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <div className="cols-2">
            <Field label="Sells as-is for">
              <input
                name="estAsIs"
                inputMode="decimal"
                defaultValue={centsToInput(item.estAsIsCents)}
                placeholder={asIs ? centsToInput(asIs) : ""}
              />
            </Field>
            <Field label="Sells cleaned for">
              <input
                name="estClean"
                inputMode="decimal"
                defaultValue={centsToInput(item.estCleanCents)}
              />
            </Field>
          </div>
          <Field label="Sells restored for">
            <input
              name="estRestored"
              inputMode="decimal"
              defaultValue={centsToInput(item.estRestoredCents)}
            />
          </Field>
          <button className="btn" type="submit">
            Save estimates
          </button>
        </form>
      </div>

      {/* ---------------- photos ---------------- */}

      <h2>Photos</h2>
      {item.photos.length > 0 ? (
        <div className="gallery">
          {item.photos.map((photo) => (
            <div key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" />
              <form action={deletePhotoAction}>
                <input type="hidden" name="photoId" value={photo.id} />
                <button
                  className="btn btn-small btn-danger btn-block"
                  type="submit"
                  style={{ marginTop: "0.3rem" }}
                >
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">
          No photos yet. A pair with no photo doesn't sell.
        </p>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <form action={addPhotosAction}>
          <input type="hidden" name="id" value={item.id} />
          <Field label="Add photos">
            <input type="file" name="photos" accept="image/*" multiple />
          </Field>
          <button className="btn" type="submit">
            Upload
          </button>
        </form>
      </div>

      {/* ---------------- details ---------------- */}

      <h2>Details</h2>
      <div className="card">
        <form action={updateItemAction}>
          <input type="hidden" name="id" value={item.id} />

          <div className="cols-2">
            <Field label="Size">
              <input name="size" defaultValue={item.size} required />
            </Field>
            <Field label="Size type">
              <select name="sizeType" defaultValue={item.sizeType}>
                {SIZE_TYPES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Condition" hint={grade?.restoreAdvice}>
            <select name="grade" defaultValue={item.grade}>
              {GRADES.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label} — {g.blurb}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Status"
            hint="In restoration shows on the shop with a ready date but can't be bought."
          >
            <select name="status" defaultValue={item.status}>
              {ITEM_STATUSES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label} — {s.blurb}
                </option>
              ))}
            </select>
          </Field>

          <div className="cols-2">
            <Field label="What you paid">
              <input
                name="cost"
                inputMode="decimal"
                defaultValue={centsToInput(item.costCents)}
              />
            </Field>
            <Field label="Asking price" hint="What shows on the shop.">
              <input
                name="listPrice"
                inputMode="decimal"
                defaultValue={centsToInput(item.listPriceCents)}
                placeholder={
                  best?.sellCents ? centsToInput(best.sellCents) : undefined
                }
              />
            </Field>
          </div>

          <Field label="Where you got them">
            <input name="acquiredFrom" defaultValue={item.acquiredFrom ?? ""} />
          </Field>

          <Field label="Ready date" hint="Shows on the shop while it's in restoration.">
            <input
              type="date"
              name="restorationEta"
              defaultValue={
                item.restorationEta
                  ? item.restorationEta.toISOString().slice(0, 10)
                  : ""
              }
            />
          </Field>

          <Field label="What you're doing to them">
            <input
              name="restorationNotes"
              defaultValue={item.restorationNotes ?? ""}
              placeholder="Deep clean, midsole de-yellow, new laces"
            />
          </Field>

          <Field label="Listing description" hint="Shows on the public page.">
            <textarea name="notes" defaultValue={item.notes ?? ""} />
          </Field>

          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </form>
      </div>

      <hr />

      <form action={deleteItemAction}>
        <input type="hidden" name="id" value={item.id} />
        <button className="btn btn-danger btn-small" type="submit">
          Delete this pair
        </button>
      </form>
    </>
  );
}

import { Field, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { centsToInput, formatBps, formatCents } from "@/lib/money";
import { featureStatuses, hasStripeKeys } from "@/lib/config";
import { onboardingBlockers } from "@/lib/stripe";
import { getSettings } from "@/lib/settings";
import {
  connectStripeAction,
  deleteChannelAction,
  refreshStripeAction,
  saveChannelAction,
  saveSellerSettingsAction,
  saveSiteSettingsAction,
} from "../actions";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; stripe?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const site = await getSettings();

  const channels = await prisma.channel.findMany({
    where: { userId: user.id },
    orderBy: { sortOrder: "asc" },
  });

  // Only ask Stripe what's outstanding if there's an account to ask about.
  let blockers: string[] = [];
  if (hasStripeKeys && user.stripeAccountId && !user.stripeReady) {
    blockers = await onboardingBlockers(user).catch(() => []);
  }

  const features = featureStatuses();

  return (
    <>
      <h1>Settings</h1>

      {sp.saved ? <Notice kind="good">Saved.</Notice> : null}
      {sp.stripe === "done" ? (
        <Notice kind="good" title="Back from Stripe">
          Hit "Check my status" below to confirm they've approved you.
        </Notice>
      ) : null}
      {sp.stripe === "checked" ? (
        <Notice kind={user.stripeReady ? "good" : "warn"}>
          {user.stripeReady
            ? "You're cleared to take payments."
            : "Stripe still wants something from you — see below."}
        </Notice>
      ) : null}
      {sp.error === "channelname" ? (
        <Notice kind="bad">A channel needs a name.</Notice>
      ) : null}

      {/* ------------- the numbers behind max buy ------------- */}

      <h2>Your numbers</h2>
      <p className="muted small prose">
        These four drive every max buy price the app gives you. Set them once
        and the calculator stops being a guess.
      </p>

      <div className="card">
        <form action={saveSellerSettingsAction}>
          <div className="cols-2">
            <Field label="Your name">
              <input name="name" defaultValue={user.name} required />
            </Field>
            <Field label="Handle" hint="Optional, for your own reference.">
              <input name="handle" defaultValue={user.handle ?? ""} />
            </Field>
          </div>

          <div className="cols-2">
            <Field
              label="Target profit per pair"
              hint="What you want to clear. The app refuses to bid past this."
            >
              <input
                name="targetProfit"
                inputMode="decimal"
                defaultValue={centsToInput(user.targetProfitCents)}
              />
            </Field>
            <Field
              label="What shipping costs you"
              hint="Label plus box plus tape, per pair you send out."
            >
              <input
                name="shipOut"
                inputMode="decimal"
                defaultValue={centsToInput(user.shipOutCents)}
              />
            </Field>
          </div>

          <div className="cols-2">
            <Field
              label="Cost of a clean"
              hint="Supplies and your time for a wash, laces and sole scrub."
            >
              <input
                name="cleanCost"
                inputMode="decimal"
                defaultValue={centsToInput(user.cleanCostCents)}
              />
            </Field>
            <Field
              label="Cost of a full restore"
              hint="Paint, sole work, deep clean. Be honest about your hours."
            >
              <input
                name="restoreCost"
                inputMode="decimal"
                defaultValue={centsToInput(user.restoreCostCents)}
              />
            </Field>
          </div>

          <Field
            label="Shipping you charge the buyer"
            hint="Added at checkout on your shop."
          >
            <input
              name="buyerShipping"
              inputMode="decimal"
              defaultValue={centsToInput(user.buyerShippingCents)}
            />
          </Field>

          <Field label="About you" hint="Optional.">
            <textarea name="bio" defaultValue={user.bio ?? ""} />
          </Field>

          <button className="btn btn-primary" type="submit">
            Save my numbers
          </button>
        </form>
      </div>

      {/* ------------- channels ------------- */}

      <h2>Where you sell, and what it costs</h2>
      <p className="muted small prose">
        Whatnot, eBay and cash in hand are three different numbers. The
        calculator shows max buy for whichever one you'd actually use.
      </p>

      <div className="stack">
        {channels.map((channel) => (
          <div className="card" key={channel.id}>
            <form action={saveChannelAction}>
              <input type="hidden" name="id" value={channel.id} />
              <div className="cols-2">
                <Field label="Name">
                  <input name="name" defaultValue={channel.name} required />
                </Field>
                <Field label="Commission %">
                  <input
                    name="feePercent"
                    inputMode="decimal"
                    defaultValue={(channel.feeBps / 100).toString()}
                  />
                </Field>
              </div>
              <div className="cols-2">
                <Field label="Flat fee per sale">
                  <input
                    name="fixedFee"
                    inputMode="decimal"
                    defaultValue={centsToInput(channel.fixedFeeCents)}
                  />
                </Field>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={channel.isDefault}
                      style={{ width: "auto", marginRight: "0.4rem" }}
                    />
                    Use this one by default
                  </label>
                </div>
              </div>
              <div className="row">
                <button className="btn btn-small" type="submit">
                  Save
                </button>
                <span className="tiny">
                  Currently {formatBps(channel.feeBps)}
                  {channel.fixedFeeCents > 0
                    ? ` + ${formatCents(channel.fixedFeeCents)}`
                    : ""}
                </span>
              </div>
            </form>
            <form action={deleteChannelAction} style={{ marginTop: "0.5rem" }}>
              <input type="hidden" name="id" value={channel.id} />
              <button className="btn btn-small btn-danger" type="submit">
                Remove
              </button>
            </form>
          </div>
        ))}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add a channel</h3>
          <form action={saveChannelAction}>
            <div className="cols-2">
              <Field label="Name">
                <input name="name" required placeholder="Instagram DMs" />
              </Field>
              <Field label="Commission %">
                <input name="feePercent" inputMode="decimal" placeholder="0" />
              </Field>
            </div>
            <Field label="Flat fee per sale">
              <input name="fixedFee" inputMode="decimal" placeholder="0.00" />
            </Field>
            <button className="btn" type="submit">
              Add
            </button>
          </form>
        </div>
      </div>

      {/* ------------- stripe ------------- */}

      <h2>Getting paid</h2>

      {!hasStripeKeys ? (
        <Notice kind="info" title="Stripe isn't connected to the app yet">
          <span className="small">
            Add <code>STRIPE_SECRET_KEY</code> and{" "}
            <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to your{" "}
            <code>.env</code> file and restart. Until then, your shop shows a
            "Message to buy" button — which works fine.
          </span>
        </Notice>
      ) : user.stripeReady ? (
        <Notice kind="good" title="You can take payments">
          <span className="small">
            Money from your sales goes to your bank account
            {user.platformFeeBps > 0
              ? `, minus the ${formatBps(user.platformFeeBps)} platform fee`
              : ""}
            .
          </span>
        </Notice>
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Finish Stripe setup</h3>
          <p className="small">
            Stripe needs to verify you before it can send you money. It'll ask
            for your legal name, date of birth, address, SSN or EIN, and a bank
            account. Stripe collects all of it directly — this app never sees
            or stores any of it.
          </p>
          {blockers.length > 0 ? (
            <div className="notice notice-warn">
              <strong>Stripe is still waiting on:</strong>
              <ul className="tight" style={{ marginBottom: 0 }}>
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="row" style={{ marginTop: "0.8rem" }}>
            <form action={connectStripeAction}>
              <button className="btn btn-primary" type="submit">
                {user.stripeAccountId
                  ? "Carry on with Stripe"
                  : "Set up payouts"}
              </button>
            </form>
            {user.stripeAccountId ? (
              <form action={refreshStripeAction}>
                <button className="btn btn-ghost" type="submit">
                  Check my status
                </button>
              </form>
            ) : null}
          </div>
        </div>
      )}

      {/* ------------- shop ------------- */}

      {user.role === "ADMIN" ? (
        <>
          <h2>Your shop</h2>
          <div className="card">
            <form action={saveSiteSettingsAction}>
              <Field label="Shop name">
                <input name="shopName" defaultValue={site.shopName} required />
              </Field>
              <Field label="Tagline" hint="The line under your name on the shop.">
                <input name="tagline" defaultValue={site.tagline} />
              </Field>
              <Field
                label="Contact line"
                hint="Shown when checkout is off, and in the footer."
              >
                <input name="contactLine" defaultValue={site.contactLine} />
              </Field>
              <Field
                label="Where 'Message to buy' goes"
                hint="Your Instagram, Facebook or WhatsApp link. Leave blank to just show the contact line."
              >
                <input
                  name="contactUrl"
                  type="url"
                  defaultValue={site.contactUrl}
                  placeholder="https://m.me/yourpage"
                />
              </Field>
              <Field label="Restoration pitch">
                <textarea
                  name="restorationBlurb"
                  defaultValue={site.restorationBlurb}
                />
              </Field>
              <button className="btn btn-primary" type="submit">
                Save shop details
              </button>
            </form>
          </div>
        </>
      ) : null}

      {/* ------------- features ------------- */}

      <h2 id="features">What's switched on</h2>
      <div className="stack">
        {features.map((feature) => (
          <div className="card" key={feature.key}>
            <div className="spread">
              <strong>{feature.name}</strong>
              <span className={`badge ${feature.on ? "badge-good" : "badge-warn"}`}>
                {feature.on ? "on" : "off"}
              </span>
            </div>
            {!feature.on ? (
              <div className="small" style={{ marginTop: "0.4rem" }}>
                <p style={{ marginBottom: "0.4rem" }}>{feature.without}</p>
                <p className="muted" style={{ marginBottom: 0 }}>
                  <strong>To turn it on:</strong> {feature.howTo}
                </p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <p className="tiny" style={{ marginTop: "1rem" }}>
        Sales tax is off unless you set <code>STRIPE_TAX_ENABLED=true</code>.
        Turn it on only after configuring tax in your Stripe dashboard —
        enabling it before then makes every checkout fail.
      </p>
    </>
  );
}

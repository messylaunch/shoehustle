import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { featureStatuses } from "@/lib/config";
import { GRADES } from "@/lib/constants";

export const metadata = { title: "How this works" };
export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const user = await requireUser();
  const off = featureStatuses().filter((f) => !f.on);

  return (
    <div className="prose">
      <h1>How this works</h1>
      <p className="muted">
        Five minutes of reading, and you'll know everything the app does.
      </p>

      <h2>Set your four numbers first</h2>
      <p>
        Every max buy price the app gives you comes out of four numbers in{" "}
        <Link href="/app/settings">Settings</Link>. Until they're right, the
        answers are guesses:
      </p>
      <ul className="tight">
        <li>
          <strong>Target profit</strong> — what you want to clear per pair. The
          app refuses to bid past this.
        </li>
        <li>
          <strong>Shipping out</strong> — label, box, tape.
        </li>
        <li>
          <strong>Cost of a clean</strong> and <strong>cost of a restore</strong>{" "}
          — supplies plus an honest number for your time.
        </li>
      </ul>
      <p>
        Then check your <strong>channels</strong> — Whatnot, eBay, cash. The
        commission differs on each, so the most you can pay differs too. The app
        shows you a ceiling per channel.
      </p>

      <h2>Pricing a pair</h2>
      <ol className="steps">
        <li>
          <strong>Photograph it</strong>
          <span className="muted">
            Side-on shot identifies the model. Add a shot of the tongue tag and
            it reads the style code, which is the only way to be sure about a
            colorway. Two colorways of the same shoe can differ by three times
            the money.
          </span>
        </li>
        <li>
          <strong>Confirm what it is</strong>
          <span className="muted">
            You get up to three candidates with a confidence level on each. Pick
            the right one, or fix the fields by hand. Never let it guess for
            you — a wrong colorway is a wrong price.
          </span>
        </li>
        <li>
          <strong>Set size and condition</strong>
          <span className="muted">
            Grades are the ones your buyers already use, so your listings read
            like they came from someone who's been doing this a while.
          </span>
        </li>
        <li>
          <strong>Look up comps</strong>
          <span className="muted">
            The pair's page has one-tap links to eBay sold prices, StockX, GOAT
            and Google Shopping — each search already filtered. Start with eBay
            sold. That's what pairs actually went for.
          </span>
        </li>
        <li>
          <strong>Add what you find</strong>
          <span className="muted">
            Two real sold comps is usually enough. Mark each one honestly as a
            sale or an ask — asks run high, and pricing off them is how you end
            up sitting on stock.
          </span>
        </li>
        <li>
          <strong>Read the verdict</strong>
          <span className="muted">
            Three lanes — as-is, cleaned, restored — each with the most you can
            pay. The best lane is marked. Then it tells you plainly whether the
            price in front of you is a buy, thin, or a walk.
          </span>
        </li>
      </ol>

      <div className="notice notice-info">
        <strong>The lane that wins isn't always the obvious one</strong>
        <span className="small">
          A full restore often sells for more and still makes you less, because
          the extra work and the fee on the higher price eat the difference. The
          app does that arithmetic every time so you don't talk yourself into
          the wrong lane.
        </span>
      </div>

      <h2>The condition grades</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Grade</th>
              <th>What it means</th>
              <th>What to do with it</th>
            </tr>
          </thead>
          <tbody>
            {GRADES.map((g) => (
              <tr key={g.code}>
                <td>{g.label}</td>
                <td className="small">{g.blurb}</td>
                <td className="small muted">{g.restoreAdvice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Moving a pair through</h2>
      <p>A pair has a status, and the status decides what shoppers see:</p>
      <ul className="tight">
        <li>
          <strong>Sourcing</strong> — you're deciding. Hidden from the shop.
        </li>
        <li>
          <strong>In hand</strong> — bought, not listed. Hidden.
        </li>
        <li>
          <strong>In restoration</strong> — <em>visible</em> with a ready date,
          but not buyable. This is a feature, not a limitation: a pair people
          can see coming is a reason to come back on Friday.
        </li>
        <li>
          <strong>Listed</strong> — live and buyable.
        </li>
        <li>
          <strong>Reserved</strong> — someone's claimed it.
        </li>
        <li>
          <strong>Sold</strong> — gone, but still visible. A sold wall builds
          trust with people deciding whether you're real.
        </li>
      </ul>

      <h2>Your shop</h2>
      <p>
        <Link href="/" target="_blank">
          Your storefront
        </Link>{" "}
        needs no login to browse and filters by size first, because nobody
        browses shoes — they look for their size. Every pair has its own link
        that generates a proper preview card when you paste it into Facebook.
      </p>
      <p>
        The size-alert form on the shop is the most valuable thing on this whole
        site. Someone whose size you don't have would otherwise leave and never
        come back; instead they hand you their email. Check{" "}
        <Link href="/app/leads">Leads</Link> — it flags anyone waiting on a size
        you now have in stock.
      </p>

      <h2>Getting paid</h2>
      <p>
        Card checkout runs through Stripe. Before money can reach you, Stripe
        verifies you: legal name, date of birth, address, SSN or EIN, and a bank
        account. Stripe collects all of that directly — this app never sees it.
      </p>
      <p>
        Until that's done, or if you'd rather not turn checkout on at all, your
        shop shows a <strong>Message to buy</strong> button and you close the
        sale the way you do now. Plenty of resellers run that way for a long
        time.
      </p>
      <p className="small muted">
        When you invite another seller, they go through the same Stripe setup on
        their own account. Tell them that up front — "give Stripe your social
        security number" is a bad surprise halfway through a signup.
      </p>

      {off.length > 0 ? (
        <>
          <h2>What's still switched off for you</h2>
          <div className="stack">
            {off.map((f) => (
              <div className="card" key={f.key}>
                <strong>{f.name}</strong>
                <p className="small" style={{ margin: "0.3rem 0" }}>
                  {f.without}
                </p>
                <p className="small muted" style={{ marginBottom: 0 }}>
                  <strong>To turn it on:</strong> {f.howTo}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2>Your first week</h2>
      <div className="card">
        <ol className="tight" style={{ marginBottom: 0, paddingLeft: "1.2rem" }}>
          <li>
            Set your four numbers in <Link href="/app/settings">Settings</Link>.
          </li>
          <li>Check the fee on each selling channel matches reality.</li>
          <li>
            Price three pairs you already own, so you can see whether the
            ceilings match your gut.
          </li>
          <li>
            List them. Add photos — a pair with no photo doesn't sell.
          </li>
          <li>
            Put your shop link in every bio you have.
          </li>
          <li>
            Post one pair with its own link and see what a real preview card
            does to your engagement.
          </li>
          <li>
            Read the <Link href="/app/playbook">playbook</Link> and pick one
            thing from it to do this week.
          </li>
        </ol>
      </div>

      <p className="tiny" style={{ marginTop: "2rem" }}>
        Signed in as {user.email}
        {user.role === "ADMIN" ? " (admin)" : ""}.
      </p>
    </div>
  );
}

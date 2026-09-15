import PublicShell from "@/components/PublicShell";
import { Notice } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { tradeInAction } from "@/app/actions";

export const metadata = { title: "Sell or trade your shoes" };
export const dynamic = "force-dynamic";

// The car-lot half of the model: you don't only sell, you take them in. It's
// also the cheapest inventory you'll ever get, because it walks to you.

export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSettings();

  return (
    <PublicShell>
      <h1>Sell or trade your shoes</h1>
      <p className="muted prose">
        Got pairs sitting in a closet you&apos;re never wearing again? I&apos;ll
        buy them outright, or give you more if you take it as credit toward
        something on the shop.
      </p>

      {params.sent ? (
        <Notice kind="good" title="Got it">
          I&apos;ll look at your photos and come back with a number — cash or
          credit, your choice. If they&apos;re not worth anything I&apos;ll tell
          you that straight instead of lowballing you.
        </Notice>
      ) : null}

      {params.error === "missing" ? (
        <Notice kind="bad" title="Missing something">
          I need your name, an email and a line about the shoes.
        </Notice>
      ) : null}

      <h2>How it works</h2>
      <div className="card prose">
        <ol className="tight">
          <li>
            <strong>Send photos and sizes.</strong> Rough is fine — I just need
            to see what they are and roughly what shape they&apos;re in.
          </li>
          <li>
            <strong>I come back with two numbers</strong>, usually the same day:
            what I&apos;ll pay in cash, and what I&apos;ll give you as credit.
            Credit is always worth more.
          </li>
          <li>
            <strong>Hand them over at a pickup meet</strong> or post them. You
            get paid when I&apos;ve got them in hand.
          </li>
        </ol>
        <p className="small muted" style={{ marginBottom: 0 }}>
          I take pairs other people would pass on — that&apos;s the whole point
          of knowing how to clean them. Beat doesn&apos;t mean worthless.
        </p>
      </div>

      <h2>What I&apos;m looking for</h2>
      <div className="cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Yes</h3>
          <ul className="tight small" style={{ marginBottom: 0 }}>
            <li>Anything that still holds its shape</li>
            <li>Dirty, creased, yellowed — all fixable</li>
            <li>Missing laces or insoles, no box</li>
            <li>Kids&apos; sizes, especially outgrown ones</li>
            <li>Bulk lots you just want gone</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Probably not</h3>
          <ul className="tight small" style={{ marginBottom: 0 }}>
            <li>Sole separated all the way round</li>
            <li>Holes through the upper</li>
            <li>Heel worn down past the foam</li>
            <li>Mould inside</li>
          </ul>
        </div>
      </div>

      <h2>Tell me what you&apos;ve got</h2>
      <div className="card">
        <form action={tradeInAction}>
          <div className="cols-2">
            <div className="field">
              <label htmlFor="t-name">Your name</label>
              <input id="t-name" type="text" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="t-email">Email</label>
              <input id="t-email" type="email" name="email" required />
            </div>
          </div>

          <div className="cols-2">
            <div className="field">
              <label htmlFor="t-phone">Phone (optional)</label>
              <input id="t-phone" type="tel" name="phone" />
            </div>
            <div className="field">
              <label htmlFor="t-city">Your town</label>
              <input
                id="t-city"
                type="text"
                name="city"
                placeholder="So I know if you can meet up"
              />
            </div>
          </div>

          <div className="cols-2">
            <div className="field">
              <label htmlFor="t-brand">Brand</label>
              <input id="t-brand" type="text" name="brand" placeholder="Nike, Jordan…" />
            </div>
            <div className="field">
              <label htmlFor="t-size">Size</label>
              <input id="t-size" type="text" name="size" placeholder="10.5" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="t-desc">What have you got?</label>
            <textarea
              id="t-desc"
              name="description"
              required
              placeholder="Three pairs — Jordan 4s size 10.5, some Dunks size 9, and a pair of AF1s my son outgrew"
            />
          </div>

          <div className="field">
            <label htmlFor="t-condition">What shape are they in?</label>
            <input
              id="t-condition"
              type="text"
              name="condition"
              placeholder="Worn a lot, midsoles gone yellow, one pair has no laces"
            />
          </div>

          <div className="field">
            <label htmlFor="t-photo">A photo helps</label>
            <input id="t-photo" type="file" name="photo" accept="image/*" />
            <div className="hint">
              One shot of them lined up in daylight is plenty.
            </div>
          </div>

          <button className="btn btn-primary" type="submit">
            Get a number
          </button>
        </form>
      </div>

      <p className="small muted">{settings.contactLine}</p>
    </PublicShell>
  );
}

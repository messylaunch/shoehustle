import PublicShell from "@/components/PublicShell";
import { Notice } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { restorationRequestAction } from "@/app/actions";

export const metadata = { title: "Restore my pair" };
export const dynamic = "force-dynamic";

// The service line. Sells to someone who doesn't want to buy anything, which
// is most of the people who'll ever land on this site.

export default async function RestorationPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSettings();

  return (
    <PublicShell>
      <h1>Restore my pair</h1>
      <p className="muted prose">{settings.restorationBlurb}</p>

      {params.sent ? (
        <Notice kind="good" title="Got it">
          I'll look at your photos and come back with a price and a turnaround
          date. If it isn't worth restoring, I'll tell you that instead of
          taking your money.
        </Notice>
      ) : null}

      {params.error === "missing" ? (
        <Notice kind="bad" title="Missing something">
          I need at least your name, an email and a line about the shoes.
        </Notice>
      ) : null}

      <h2>What I can do</h2>
      <div className="card prose">
        <ul className="tight">
          <li>
            <strong>Deep clean</strong> — uppers, midsoles, laces and insoles.
            Takes most pairs from "worn" back to "looks after".
          </li>
          <li>
            <strong>Sole restore</strong> — de-yellowing, scrubbing, edge work
            on midsoles that have gone amber.
          </li>
          <li>
            <strong>Paint and touch-up</strong> — scuffs, worn toe boxes, colour
            brought back where it's rubbed off.
          </li>
          <li>
            <strong>An honest no</strong> — if the sole's separating or the
            upper's torn, I'll say so rather than charge you for a pair that
            won't survive the work.
          </li>
        </ul>
      </div>

      <h2>Send me the details</h2>
      <div className="card">
        <form action={restorationRequestAction}>
          <div className="cols-2">
            <div className="field">
              <label htmlFor="r-name">Your name</label>
              <input id="r-name" type="text" name="name" required />
            </div>
            <div className="field">
              <label htmlFor="r-email">Email</label>
              <input id="r-email" type="email" name="email" required />
            </div>
          </div>

          <div className="field">
            <label htmlFor="r-phone">Phone (optional)</label>
            <input id="r-phone" type="tel" name="phone" />
          </div>

          <div className="field">
            <label htmlFor="r-shoe">What are they?</label>
            <input
              id="r-shoe"
              type="text"
              name="shoeDescription"
              required
              placeholder="Jordan 4 Bred, size 10.5"
            />
          </div>

          <div className="field">
            <label htmlFor="r-condition">What's wrong with them?</label>
            <textarea
              id="r-condition"
              name="condition"
              placeholder="Midsoles have gone yellow, toe box is creased, one lace is gone…"
            />
          </div>

          <div className="field">
            <label htmlFor="r-photo">A photo helps a lot</label>
            <input id="r-photo" type="file" name="photo" accept="image/*" />
            <div className="hint">
              One clear side-on shot in daylight tells me more than a paragraph.
            </div>
          </div>

          <button className="btn btn-primary" type="submit">
            Send it over
          </button>
        </form>
      </div>
    </PublicShell>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/config";

export const metadata = { title: "Marketing playbook" };
export const dynamic = "force-dynamic";

// The game plan. Written against one specific argument: if you bring your own
// audience, the algorithm stops being the thing that decides your month.

export default async function PlaybookPage() {
  await requireUser();

  const [listed, alerts, inRestoration] = await Promise.all([
    prisma.inventoryItem.count({ where: { status: "LISTED" } }),
    prisma.sizeAlert.count(),
    prisma.inventoryItem.count({ where: { status: "IN_RESTORATION" } }),
  ]);

  return (
    <div className="prose">
      <h1>Marketing playbook</h1>
      <p className="muted">
        Your whole argument is right: if you bring your own people, the
        algorithm stops deciding your month. But that only pays off if the
        place you send them does something a live room can't. This is how to
        make that true.
      </p>

      <div className="card">
        <strong>Where you are right now</strong>
        <ul className="tight" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
          <li>
            <strong>{listed}</strong> pairs live on the shop
          </li>
          <li>
            <strong>{alerts}</strong> people on your size-alert list
          </li>
          <li>
            <strong>{inRestoration}</strong> pairs mid-restoration you could be
            posting about
          </li>
        </ul>
      </div>

      <h2>1. The link is the whole strategy</h2>
      <p>
        One URL, in every bio you own, in every comment you leave, at the end of
        every video:
      </p>
      <p className="mono card" style={{ wordBreak: "break-all" }}>
        {appUrl}
      </p>
      <p>
        Facebook, Instagram, TikTok, your Whatnot profile, your text signature.
        The point isn't traffic for its own sake — it's that every person who
        clicks it can be captured by the size-alert form, and once they're on
        that list you can reach them for free, forever, without asking anyone's
        permission.
      </p>
      <p>
        <strong>That list is the actual asset.</strong> Not the shoes. Shoes
        turn over. A thousand people who told you their size don't.
      </p>

      <h2>2. Post the shoe, not the shop</h2>
      <p>
        Nobody stops scrolling for "check out my store." They stop for a
        specific pair in their size at a price they can judge instantly. So
        post individual pairs, each linking to its own page:
      </p>
      <p className="mono card small" style={{ wordBreak: "break-all" }}>
        {appUrl}/shoe/…
      </p>
      <p>
        Every pair on your shop has its own link, and that link generates a
        preview card with the photo, the size, the condition and the price
        already on it. A post with that card gets stopped on. A post with a bare
        homepage link gets scrolled past.
      </p>
      <p className="small muted">
        Practical version: when you list a pair, copy its link, post it with one
        line — "Size 10.5, cleaned, $85, shipped today if you want it." Then get
        on with your day.
      </p>

      <h2>3. Restoration is your most watchable content, and it's free</h2>
      <p>
        This is the thing you're sitting on and not using. Almost nobody knows
        how to bring a beat pair back, which makes the process itself
        interesting to people who will never buy a shoe from you.
      </p>
      <ul className="tight">
        <li>
          <strong>Before shot</strong> when the pair lands. Yellowed, creased,
          honestly bad.
        </li>
        <li>
          <strong>Mid-clean shot</strong> — one shoe done, one not. This is the
          single best image in sneaker content and it costs you nothing.
        </li>
        <li>
          <strong>After shot</strong>, with the link and the price.
        </li>
      </ul>
      <p>
        Mark a pair <em>In restoration</em> with a ready date and it shows on
        your shop as coming soon rather than being hidden. That gives you three
        posts and a reason for someone to come back on Friday, out of one pair
        you were cleaning anyway.
      </p>
      <p className="small muted">
        The second thing this does: it advertises the service. Every person who
        watches you fix a pair is a person who might pay you to fix theirs, and
        that customer never costs you inventory.
      </p>

      <h2>4. Work the list, don't just collect it</h2>
      <p>
        The <Link href="/app/leads">Leads page</Link> flags anyone waiting on a
        size you now have in stock. That's the easiest money in the whole
        operation: they already told you what they want, and you already have
        it.
      </p>
      <p>
        Message them individually, not as a blast. "You said you're a 10.5 — got
        a pair of 4s in, cleaned, $85. Want them?" One line. People answer that.
      </p>

      <h2>5. Use the room to feed the list</h2>
      <p>
        You're right that the room drains — a hundred people at the start, sixty
        by the middle, thirty at the end. Fighting that is fighting the format.
        Use it instead:
      </p>
      <ul className="tight">
        <li>
          Say the link out loud early, while there are still a hundred people
          there, not at the end when there are thirty.
        </li>
        <li>
          Ask for sizes in the chat. "Drop your size and I'll tell you what I've
          got." Every answer is a lead you can put on the list yourself.
        </li>
        <li>
          When someone loses a bid, that's your best moment: "I'll message you
          when I get another in your size." Then actually do it.
        </li>
      </ul>
      <p>
        The room is a lead source that occasionally sells things. Once you see
        it that way, the algorithm stops being the thing that decides whether
        your night was worth it.
      </p>

      <h2>6. On Josh's objection</h2>
      <p>
        He doesn't want it turning into personal shopping. That's a fair
        instinct, and the answer isn't to argue with it — it's that personal
        shopping is bad when it's <em>unpaid and unscheduled</em>, not when it's
        the business.
      </p>
      <p>
        A list of two hundred people with known sizes isn't personal shopping.
        It's inventory matching, it takes ten minutes, and it turns dead stock
        into cash without a live show. The thing he's actually objecting to —
        chasing individuals through DMs for a $40 sale at midnight — is what
        happens when you <em>don't</em> have the list and have to hustle each
        sale one at a time.
      </p>
      <p className="small muted">
        Worth saying to him plainly: he has more pairs than he can move, and
        going through bins without looking is how good shoes get sold for a
        dollar. Matching them against a size list is the opposite of that.
      </p>

      <h2>7. A week that works</h2>
      <div className="card">
        <ul className="tight" style={{ marginBottom: 0 }}>
          <li>
            <strong>Monday</strong> — post the weekend's pickups. Before shots
            of anything going into restoration.
          </li>
          <li>
            <strong>Tuesday</strong> — mid-clean shot. One shoe done, one not.
          </li>
          <li>
            <strong>Wednesday</strong> — post one pair with its link and price.
          </li>
          <li>
            <strong>Thursday</strong> — the after shot, with the link. "Ready
            tomorrow."
          </li>
          <li>
            <strong>Friday</strong> — it's live. Message everyone on the list in
            that size.
          </li>
          <li>
            <strong>Weekend</strong> — the room. Say the link early, collect
            sizes, follow up with everyone who lost a bid.
          </li>
        </ul>
      </div>

      <h2>8. Lines that work</h2>
      <div className="card small">
        <p>
          <strong>Posting a pair:</strong> "Size 10.5, cleaned up, $85. Link's
          in the bio if you want them — they don't usually sit long in that
          size."
        </p>
        <p>
          <strong>Restoration before/after:</strong> "Same shoe. Two hours
          apart. If you've got a pair you gave up on, send me a photo — I'll
          tell you straight whether they're worth saving."
        </p>
        <p>
          <strong>Working the list:</strong> "You told me you're a 10.5 — got a
          pair in. Cleaned, $85, I can ship today. Want them?"
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>In the room, early:</strong> "Everything I've got is on my
          link with sizes on it. Even if you don't win tonight, put your size in
          and I'll tell you when yours comes up."
        </p>
      </div>

      <h2>The one number to watch</h2>
      <p>
        Not followers. Not views. <strong>People on the size list.</strong> It's
        the only number here that compounds, the only one you own outright, and
        the only one that makes a bad night in a room stop mattering.
      </p>
      <p className="small muted">
        You have {alerts} right now.{" "}
        {alerts === 0
          ? "Everything above is about turning that into a number bigger than zero."
          : "Every post should be trying to make that bigger."}
      </p>
    </div>
  );
}

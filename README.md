# Well Kept

Secondhand sneakers, properly looked after.

A sourcing calculator that tells you the most you should pay for a pair of
shoes, bolted to an installable storefront you can put in a link in bio — plus
a reseller network, weekly drops, and honest condition disclosure.

The shop name is a setting, not a decision you're stuck with. Change it on
`/app/settings`.

No API keys required to run — photo ID, card checkout and push notifications
are optional extras that switch on when you add keys, and the app tells you
exactly what's off and how to turn it on.

## Deploying it

See **[DEPLOY.md](DEPLOY.md)** — Vercel, a Neon Postgres database and a Blob
store for photos. Four steps, three of which are required before the build
will succeed.

## Running it locally

Needs a Postgres to point at; the easiest start is the same Neon database as
production, or a second Neon branch once you want one you can't break.

```bash
npm install
cp .env.example .env     # paste DATABASE_URL and DIRECT_URL
npm run setup            # generates the client and creates the tables
npm run dev
```

Open http://localhost:3000. The first visit sends you to `/setup` to create
your account — that account is the admin and the only one that can invite
other sellers. Leave `BLOB_READ_WRITE_TOKEN` unset locally and photos are
written to `public/uploads` instead of Blob storage.

## What it does

**Back of house** (`/app`, needs a login)

- **Price a pair** — photograph a shoe, confirm what it is, set size and
  condition. Then one-tap links to eBay sold prices, StockX, GOAT and Google
  Shopping, each search already filtered.
- **Max buy price** in three lanes — sell as-is, clean it, full restore —
  each accounting for the channel's fee, your shipping, the cost of the work
  and your target profit. The best lane is marked, and the verdict tells you
  plainly whether the price in front of you is a buy, thin, or a walk.
- **Inventory** from sourcing through restoration to sold, with cost basis.
- **Orders**, shipping and tracking.
- **Leads** — size alerts and restoration enquiries, with anyone waiting on a
  size you now hold flagged for you, and a one-tap "tell them it's here".
- **Drops** — run a weekly auction on one hot pair.
- **Network** — reseller links, splits, and what you owe each person.
- **Playbook** — the marketing game plan.
- **Guide** — how all of it works.

**Front of house** (public, no login)

- Size-filtered grid of everything in stock.
- Per-pair page with its own URL and a real preview card for social posts.
- Pairs mid-restoration shown with a ready date, visible but not buyable.
- **Installable to a phone's home screen**, with push notifications targeted
  to the sizes each shopper actually watches.
- **Honest condition disclosure** — what was done to a pair, and what still
  isn't right about it, both as structured lists.
- **Value check** — the new price struck through, plus StockX, GOAT and Google
  Shopping links so a buyer can verify rather than take your word.
- Size-alert capture that records who they're shopping for, so one parent can
  watch their own size and their kids'.
- Restoration intake form.
- **Weekly drop** with public bidding and a countdown.

## The reseller network

Two arrangements, deliberately kept separate because conflating them is what
makes splits feel unfair:

| Route | How it works | Who holds the risk |
| --- | --- | --- |
| **Referral link** (`/r/<handle>`) | They share it, the buyer pays you at list price, you ship. They earn a share of the margin. | Nobody — they never touch shoe or money |
| **Reseller price** | They buy the pair off you cheaper and sell it however they like. | Them — their money is tied up |

Both pay the same, so a reseller picks the route that suits them rather than
the one that pays better. The split is one number per person (default 30%) set
on `/app/sellers`.

Commission is **tracked, not automatically transferred**. The card payment
lands with you in full; `/app/network` totals what you owe each reseller and
you pay it out yourself.

## The pricing math

```
max buy = (sell x (1 - fee)) - flat fee - shipping - recondition - target profit
```

Estimates come from comps you enter, preferring real sold prices at the same
grade. When there are none it falls back down a ladder — sold comps at other
grades, then asking prices discounted 15%, then retail times a grade
multiplier — and always tells you which rung it landed on. It never shows a
number without saying where it came from.

Run `npm test` for the 89 unit tests covering the arithmetic, the comp ladder,
the research links, the reseller splits and the auction rules.

## Optional keys

Everything below is off by default. The app works without all of it.

| Key | Turns on | Without it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Photo shoe ID | You type the shoe in yourself |
| `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Card checkout | Shop shows "Message to buy" |
| `STRIPE_WEBHOOK_SECRET` | Payment confirmation | Orders would never leave "awaiting payment" |
| `STRIPE_TAX_ENABLED=true` | Sales tax at checkout | No tax collected |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Push notifications | Shoppers can still install the app, they just never hear from you |

Generate the push keys once with `npm run push:keys` and leave them alone —
changing them makes every shopper opt in again.

**Turn the webhook on before taking a real order.** It's what marks an order
paid and locks the pair so it can't sell twice.

For local Stripe testing:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Seller payouts

Payments use Stripe Connect. Every seller — you included — completes Stripe's
onboarding before money can reach them: legal name, date of birth, address,
SSN or EIN, and a bank account. Stripe collects all of it directly; this app
never sees or stores any of it. Worth telling a seller up front rather than
halfway through their signup.

Your cut from each seller is set per seller on `/app/sellers` and defaults to
0%.

## Testing

```bash
npm test          # unit tests
npm run typecheck # types
npm run build     # production build

# End to end. Needs the app running on :3100 against an empty database,
# plus Playwright: npm i -D playwright && npx playwright install chromium
npm run smoke
```

The smoke test drives a real browser through 36 checks: account creation,
pricing a pair, adding comps, listing it, the storefront, the size filter,
flaw disclosure, reseller links and attribution, running a drop and bidding
on it (including rejecting an under-increment bid), the PWA manifest and
every icon it names, size-alert capture and the restoration form.

## Stack

Next.js (App Router) · Postgres via Prisma · plain CSS · Stripe Connect ·
Vercel Blob for photos · Claude for photo ID.

Photo storage is isolated in `src/lib/uploads.ts`: it writes to Vercel Blob
when `BLOB_READ_WRITE_TOKEN` is set and to local disk otherwise, and nothing
else in the app knows which it got.

# Shoe Hustle

A sourcing calculator that tells you the most you should pay for a pair of
shoes, bolted to a size-filterable storefront you can put in a link in bio.

Runs with zero setup. No API keys required — photo ID and card checkout are
optional extras that switch on when you add keys, and the app tells you
exactly what's off and how to turn it on.

## Running it

```bash
npm install
cp .env.example .env
npm run setup     # generates the Prisma client and creates the SQLite database
npm run dev
```

Open http://localhost:3000. The first visit sends you to `/setup` to create
your account — that account is the admin and the only one that can invite
other sellers.

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
  size you now hold flagged for you.
- **Playbook** — the marketing game plan.
- **Guide** — how all of it works.

**Front of house** (public, no login)

- Size-filtered grid of everything in stock.
- Per-pair page with its own URL and a real preview card for social posts.
- Pairs mid-restoration shown with a ready date, visible but not buyable.
- Size-alert capture for anyone whose size you don't have.
- Restoration intake form.

## The pricing math

```
max buy = (sell x (1 - fee)) - flat fee - shipping - recondition - target profit
```

Estimates come from comps you enter, preferring real sold prices at the same
grade. When there are none it falls back down a ladder — sold comps at other
grades, then asking prices discounted 15%, then retail times a grade
multiplier — and always tells you which rung it landed on. It never shows a
number without saying where it came from.

Run `npm test` for the 51 unit tests covering the arithmetic, the comp ladder
and the research links.

## Optional keys

Everything below is off by default. The app works without all of it.

| Key | Turns on | Without it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Photo shoe ID | You type the shoe in yourself |
| `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Card checkout | Shop shows "Message to buy" |
| `STRIPE_WEBHOOK_SECRET` | Payment confirmation | Orders would never leave "awaiting payment" |
| `STRIPE_TAX_ENABLED=true` | Sales tax at checkout | No tax collected |

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
node scripts/smoke.mjs   # end-to-end, needs the app running on :3100
```

The smoke test drives a real browser through account creation, pricing a
pair, adding comps, listing it, the storefront, the size filter, size-alert
capture and the restoration form.

## Stack

Next.js (App Router) · SQLite via Prisma · plain CSS · Stripe Connect ·
Claude for photo ID.

SQLite keeps setup to nothing. When one machine stops being enough, change the
`datasource` in `prisma/schema.prisma` to Postgres and move photo storage out
of `src/lib/uploads.ts` — nothing else in the app knows where either lives.

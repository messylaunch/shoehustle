# Putting Well Kept on the internet

The app is built for Vercel. Vercel rebuilds automatically every time code is
pushed to the default branch, so once the four things below are set, deploying
is something that just happens.

**Until you finish steps 1 and 2 the build will fail.** That is expected — the
app needs a database and somewhere to keep photos, and Vercel gives you
neither by default.

---

## 1. A database — required

Vercel has no disk that survives a deploy, so the data lives in Postgres.

1. In your Vercel project, open **Storage**.
2. **Create Database** → choose **Neon** (Postgres). The free tier is fine to
   start with.
3. Connect it to this project when it asks.

Neon sets some connection strings for you, but **the names may not match what
the app expects**. Open **Settings → Environment Variables** and make sure
these two exist, exactly these names:

| Name | What to put in it |
| --- | --- |
| `DATABASE_URL` | The **pooled** connection string |
| `DIRECT_URL` | The **unpooled** / direct connection string |

Neon usually calls them `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. If so, add
a new variable called `DIRECT_URL` and paste the unpooled value into it.

> **Why two?** The app uses the pooled one for speed. Database migrations run
> at build time and need the direct one — connection poolers reject the
> statements migrations use. If you only have one string, put it in both; it
> will work, just less efficiently.

## 2. Photo storage — required

1. **Storage** → **Create** → **Blob**.
2. Connect it to the project.

That sets `BLOB_READ_WRITE_TOKEN` for you. Nothing else to do — the app
detects it and starts putting shoe photos there instead of on disk.

Skip this and photo uploads will fail in production.

## 3. Your site address — required

Add one more environment variable:

| Name | Value |
| --- | --- |
| `APP_URL` | Your real address, e.g. `https://wellkept.shop` |

Use the `.vercel.app` address at first, then change it when you buy a domain.

This one is easy to forget and the symptom is confusing: share links, Stripe
redirects and seller invite links will all point at `localhost` and appear
broken to everyone but you.

## 4. Redeploy

**Deployments** → the latest one → **⋯** → **Redeploy**.

Environment variables are read at build time, so a deploy from before you
added them won't pick them up. This step is what makes the first three count.

---

## Then open your site

You'll land on `/setup`, which appears only while no account exists. Create
your account there — it becomes the admin, and the only one that can invite
other sellers. After that the page disappears for good.

---

## Optional extras, in the order worth adding them

Everything below is off by default and the app tells you what's off and how to
switch it on, under **Settings → What's switched on**.

| Add | Turns on | Without it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Photo shoe ID | You type the shoe in — about 20 seconds |
| `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Card checkout | Shop shows "Message to buy" |
| `STRIPE_WEBHOOK_SECRET` | Payment confirmation | Orders never leave "awaiting payment" |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | Push notifications | People can install the app but never hear from you |

**Do not take a real order before the Stripe webhook is set.** It is the thing
that marks an order paid and locks the pair so it can't sell twice.

For the webhook: in Stripe, **Developers → Webhooks → Add endpoint**, point it
at `https://your-domain/api/webhooks/stripe`, and subscribe to
`checkout.session.completed`, `checkout.session.expired` and `charge.refunded`.
Paste the signing secret into `STRIPE_WEBHOOK_SECRET`.

For push keys, run `npm run push:keys` locally and paste the two values it
prints. Generate them once and leave them alone — changing them makes every
shopper opt in again.

---

## Running it on your own machine

You still need a Postgres to point at. The simplest thing is to use the same
Neon database as production while you're the only one using it:

```bash
npm install
cp .env.example .env     # paste your DATABASE_URL and DIRECT_URL
npm run setup            # creates the tables
npm run dev
```

Leave `BLOB_READ_WRITE_TOKEN` out locally and photos are written to
`public/uploads` instead, which is easier to poke at.

When you want a database you can't break anything with, make a second Neon
branch and point your local `.env` at that instead.

---

## When something goes wrong

**The build fails on `prisma migrate deploy`** — `DIRECT_URL` is missing or
has the pooled string in it. It needs the direct/unpooled one.

**The site loads but every page errors** — `DATABASE_URL` is missing or wrong.
Check it's set for the Production environment specifically, not just Preview.

**Photo uploads fail in production** — no Blob store connected. Step 2.

**Share links and Stripe returns point at localhost** — `APP_URL` is unset.
Step 3, then redeploy.

**`/setup` won't load and you have no account** — an account already exists.
Sign in at `/login`, or clear the `User` table in Neon and reload.

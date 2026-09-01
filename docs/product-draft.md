# Shoe Hustle — Product Draft v0.2

A sourcing calculator that tells you your max buy price, bolted to a size-filterable
storefront you can drop in a link in bio. One app, two very different jobs.

Status: decisions locked, building against them. Scope is a multi-seller marketplace with
in-app checkout via Stripe Connect. See §9.

---

## 1. This is two apps wearing one coat

Everything in the concept splits cleanly down the middle. Keeping the halves separate is
what stops this from becoming a nine-month project. They share exactly one thing: a pair
of shoes in inventory. Price it in the back, show it in the front. That shared record is
the whole architecture.

### Back of house — private

- Photograph a shoe, confirm the match
- Pick size and condition
- Pull comps from the market
- Estimated sell price for new / used / restored
- **The most you should pay** — the one number that matters
- Log actual cost, track the pair from box to sold

### Front of house — public

- Everything in hand, on one page
- Filter by size first (the only filter that matters)
- Condition badges people trust
- Shoes mid-restoration shown with a ready date
- Every pair gets its own shareable link
- "Tell me when my size drops" — you keep the list

---

## 2. What happens when you photograph a shoe

Should take under a minute standing in a room with a phone out, because that's the real
usage context.

1. **Snap the shoe.** Side profile is enough. App guesses brand, model, colorway.
2. **Snap the tongue tag if you want it exact.** The style code (e.g. `DH6927-111`) is
   printed inside the tongue and on the box end. It's the shoe's fingerprint and beats
   any silhouette guess, especially on near-identical colorways.
3. **Confirm the match.** Three candidates, tap the right one. Never silently guess wrong
   and price the wrong shoe.
4. **Size and condition.** Size from a picker, condition on the grade scale below.
5. **Comps come back.** Recent sold prices at that size and grade, with source and date on
   each, plus reference photos to eyeball the grade against what actually sold.
6. **The verdict.** Estimated sell price in three lanes — as-is, cleaned, fully restored —
   and max buy price for each.
7. **Buy it and it becomes inventory.** One tap moves it from priced to owned with real
   cost basis. No double entry.

---

## 3. The core math

The valuable part isn't AI. It's subtraction you'd otherwise do in your head at 11pm in a
live room with forty seconds to bid.

```
max buy = (est. sell price × (1 − fee %)) − shipping − restoration cost − target profit
```

Worked example — a pair at ~$23, worth ~$120 new, ~$65 used, on a channel taking ~11%
between commission and payment processing:

| Line | Amount |
| --- | ---: |
| Est. sell — used, as-is | $65.00 |
| Est. sell — restored | $95.00 |
| Platform fees @ 11% | −$10.45 |
| Shipping out | −$12.00 |
| Restoration (supplies + 90 min) | −$18.00 |
| Target profit | −$30.00 |
| **Max buy — restore lane** | **$24.55** |

At $23 you're in, barely, with room for one thing to go wrong. At $30 you're working for
free. Same call whether it's a $40 shoe or a $400 one.

**The app's job isn't to tell you what a shoe is worth. It's to tell you to stop bidding.**

Fees are per-channel — Whatnot, eBay, and hand-to-hand are three different numbers. Hold a
rate per channel and show max buy for whichever one you'd actually use.

---

## 4. Condition grades

Don't invent a scale. Sneaker buyers already grade in deadstock terms, and using their
words makes listings read like they came from someone who's been doing this a while. It
also gives the pricing engine something consistent to key off.

| Grade | Meaning | Restore? |
| --- | --- | --- |
| DS | Deadstock. Never worn, all original packaging | No — sell as-is |
| VNDS | Tried on, maybe walked indoors. No creasing | No |
| 9/10 | Light wear, faint creasing, clean sole | Quick clean only |
| 8/10 | Obvious creasing, sole dirty but intact | Clean pays for itself |
| 7/10 | Heavy wear, yellowing, scuffs | Full restore or pass |
| 6 and under | Sole separation, holes, heel drag | Parts or pass |

Show sold comps *at the selected grade*, never a blended average across all conditions. A
blended number is how you talk yourself into a bad buy.

---

## 5. Inventory states

A shoe mid-restoration shouldn't be buyable, but it *should* be visible. That's the
difference between an inventory field and a marketing feature.

| State | Meaning | On the storefront? |
| --- | --- | --- |
| Sourcing | Priced but not bought yet | Hidden |
| In hand | Owned, photographed, not listed | Hidden |
| In restoration | Being cleaned, painted, soled | Visible with ready date, not buyable |
| Listed | For sale right now | Visible, buyable |
| Reserved | Claimed, money pending | Visible, marked held |
| Sold | Gone | Optional — a sold wall builds trust |

**Let people claim a shoe that's still in restoration.** If a pair shows "ready Friday" and
a buyer can put a deposit down or get in line, you get paid before doing the work and you
know the work is worth doing. It also gives you something to post that isn't a finished
product: the before shot, the mid-clean shot, the reveal. Restoration content is the most
watchable thing in the business and right now it's invisible to customers.

---

## 6. The storefront is the marketing argument

The thesis — the algorithm stops mattering if you bring your own people — only holds if
the destination does two things a Whatnot room can't.

- **Size first, always.** Nobody browses shoes; they look for their size. One tap from the
  top of the page, not buried in a filter drawer.
- **Every pair gets its own link and share card.** Paste a shoe's link into a Facebook post
  and the preview shows the shoe, size, condition, price. That's what makes a post
  stoppable in a feed.
- **The size alert is the actual product.** Someone lands, their size isn't there, they
  leave — normally that's the end. Instead: "Tell me when a 10.5 drops." Now you have their
  contact info, and next time you pick up three pairs in that size, one message converts.
  That list is yours and no platform can throttle it.
- **Restoration intake.** A service you can sell to someone who doesn't want to buy
  anything. Photo upload, quote, turnaround date. Costs nothing to list and it's the offer
  that separates you from every other reseller with a link in bio.

---

## 7. Four things harder than they sound

None kill the idea; all of them change what gets built first.

**StockX doesn't hand out its prices.** No open public API. Official access runs through a
partner program requiring application and approval. Unofficial scrapers break constantly
and violate terms — bad foundation for a business with your name on it.
→ Build the pricing engine with a swappable data source, ship with what we can access
legitimately, always allow manual comp entry.

**eBay gives away asking prices, not sold prices.** The open API returns active listings —
what people *hope* to get. Sold/completed comps sit behind a separate restricted API
requiring approval. Asking prices run high, and pricing off them is how you sit on
inventory.
→ Apply for sold-comps access; meanwhile label active listings honestly as asks, not sales.

**Photo ID gets the model right and the colorway wrong.** A vision model nails "Jordan 4"
from a silhouette every time. Telling two similar colorways apart in bad phone lighting is
where it slips, and the wrong colorway can be off by 3×.
→ Guess from the photo for speed, offer the tongue-tag shot for certainty, always confirm.

**You've chosen to be a marketplace, so here's the bill.** Josh lists a pair, a stranger's
card gets charged, and the money has to reach Josh minus the platform's cut. That's Stripe
Connect, and it drags in seller identity verification, payouts, refunds, chargebacks, and
marketplace sales tax. The part that catches people out is onboarding: before a seller can
be paid, Stripe needs legal name, SSN or EIN, date of birth, address, and bank account.
→ Stripe Connect Express so Stripe hosts onboarding and carries the verification burden.
Platform fee taken per sale. Stripe Tax on from the start rather than retrofitted.

---

## 8. Build order — three milestones

Both halves grow together. Sequencing is about what has to exist before the next thing
works, not which half matters more.

**Milestone 1 — The spine.** One shoe goes in the back and comes out the front; nothing
charges a card yet. Photo → identify → confirm → size + grade. Comps from legitimate
sources plus manual entry. Max buy per channel with fee settings. Save to inventory with
real cost basis. Public storefront reading that same inventory, filtered by size. Per-shoe
URL and share card.

**Milestone 2 — Checkout.** The whole payments layer, done once and properly. Stripe
Connect Express onboarding. Card checkout with the platform fee split out automatically.
Orders, shipping addresses, tracking, mark-as-shipped. Refunds and a written dispute
policy. Stripe Tax. Inventory locks at payment so nothing sells twice.

**Milestone 3 — The network and the list.** Invited sellers with their own logins,
inventory, and payouts. One combined storefront, filterable by seller. Size alerts.
Restoration intake with quotes and turnaround dates. Deposits on pairs still in
restoration.

---

## 9. Decisions

| Decision | Call | What it costs us |
| --- | --- | --- |
| Build order | Both halves, thin | Longer to first usable thing, but the storefront is live while the calculator is still being learned |
| Shoe ID | Photo guess + optional tag shot | Nothing meaningful — vision cost per lookup is fractions of a cent |
| Payments | Full in-app checkout | Biggest single line item. Connect onboarding, orders, shipping, refunds, tax |
| Sellers | Invited sellers | Auth, roles, per-seller inventory and payouts from day one |

### What checkout adds that isn't obvious

- **Seller onboarding is a real gate.** Stripe needs legal name, SSN or EIN, DOB, address,
  and bank account before anyone gets paid.
- **Buyers will ask where their shoe is.** Orders need shipping addresses, tracking, and a
  status a buyer can check without messaging anyone.
- **Chargebacks land on the platform.** Stripe pulls from the platform; the platform
  recovers from the seller. Get that in writing before the first sale, not after the first
  dispute.
- **One pair, one buyer.** Inventory must lock at payment. Two buyers on the same pair
  thirty seconds apart is the failure that costs a customer.
- **Sales tax.** Marketplace facilitator rules mean the platform collects. Stripe Tax
  handles it if enabled from the start.

### Proceeding on assumption

Two numbers needed eventually, not blocking. Both are configurable settings rather than
baked into code.

- **Platform fee** defaults to 0% until a number is agreed with each seller.
- **Shipping** charged to the buyer at a flat rate set per seller.

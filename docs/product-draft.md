# Shoe Hustle — Product Draft v0.1

A sourcing calculator that tells you your max buy price, bolted to a size-filterable
storefront you can drop in a link in bio. One app, two very different jobs.

Status: pre-build. Four open questions below block the first line of code.

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

**The moment money flows through the app, you're a marketplace.** If another seller lists a
pair and a stranger's card gets charged inside your app, you've taken on payouts, identity
verification, chargebacks, and fraud. Biggest fork in the project.
→ Phase 1 is a catalog with offers and contact handoff. Add checkout once traffic justifies
the overhead.

---

## 8. Build order

Each phase is usable on its own.

**Phase 1 — The calculator, single user.** Photo → identify → confirm → size + grade.
Comps from legitimate sources plus manual entry. Max buy per channel with fee settings.
Save to inventory with real cost basis.

**Phase 2 — The public page.** Read-only, fast, no login to browse. Size-filtered grid.
Per-shoe URL and share card. Condition badges and restoration ready-dates. Size alerts and
restoration intake.

**Phase 3 — Money and holds.** Offers and reservations with a hold timer. Deposits on pairs
still in restoration. Checkout if Phase 2 traffic justifies it.

**Phase 4 — Multi-seller.** Invited sellers with their own logins and inventory. One
combined storefront, filterable by seller. Whatever cut or flat fee the arrangement calls
for.

---

## 9. Open questions

1. **Which half first?** Calculator (useful with one user and zero traffic, fills the
   inventory the storefront needs) vs. storefront vs. thin slices of both.
2. **How do we identify the shoe?** Photo-only AI guess (fastest, least accurate) vs. style
   code from the tongue tag (one extra photo, near-exact) vs. search-and-pick from a
   catalog (boring, never wrong).
3. **How does money change hands?** Catalog with off-app close (fastest, near-zero
   liability) vs. deposits-only vs. full in-app checkout.
4. **Who gets to list?** Just you vs. invited sellers vs. open signup.

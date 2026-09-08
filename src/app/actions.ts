"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canTakePayments } from "@/lib/config";
import { isBuyableStatus } from "@/lib/constants";
import { highBid, rejectBid } from "@/lib/auction";
import { formatCents, parseCents } from "@/lib/money";
import { sendToSubscriptions } from "@/lib/push";
import { createCheckoutSession, platformFeeFor } from "@/lib/stripe";
import { referralCommissionCents } from "@/lib/affiliate";
import { referringReseller } from "@/lib/referral";
import { storePhoto, UploadError } from "@/lib/uploads";

// Actions a shopper can trigger. Nothing here requires a login.

export async function sizeAlertAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const size = String(formData.get("size") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const forWho = String(formData.get("forWho") ?? "").trim();

  if (!email || !size) redirect("/?alert=missing");

  // Signing up twice for the same size shouldn't create two rows, but the
  // same person watching a second size (their kid's) should.
  const existing = await prisma.sizeAlert.findFirst({
    where: { email, size },
  });

  if (existing) {
    await prisma.sizeAlert.update({
      where: { id: existing.id },
      data: {
        note: note || existing.note,
        forWho: forWho || existing.forWho,
      },
    });
  } else {
    await prisma.sizeAlert.create({
      data: { email, size, note: note || null, forWho: forWho || null },
    });
  }

  redirect("/?alert=ok");
}

export async function restorationRequestAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const shoeDescription = String(formData.get("shoeDescription") ?? "").trim();
  const condition = String(formData.get("condition") ?? "").trim();

  if (!name || !email || !shoeDescription) {
    redirect("/restoration?error=missing");
  }

  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      const stored = await storePhoto(photo);
      photoUrl = stored.url;
    } catch (error) {
      // A bad photo shouldn't lose the whole enquiry — take the rest.
      if (!(error instanceof UploadError)) throw error;
    }
  }

  await prisma.restorationRequest.create({
    data: {
      name,
      email,
      phone: phone || null,
      shoeDescription,
      condition: condition || null,
      photoUrl,
    },
  });

  redirect("/restoration?sent=1");
}

/**
 * Places a bid on the weekly drop.
 *
 * Bids are binding-by-honour, not by card: nobody is charged here. The
 * winner gets contacted when the timer runs out. That keeps a marketing
 * feature from turning into a payments problem.
 */
export async function placeBidAction(formData: FormData) {
  const auctionId = String(formData.get("auctionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const amountCents = parseCents(formData.get("amount"));

  const back = (error: string) =>
    redirect(`/drop/${auctionId}?error=${encodeURIComponent(error)}`);

  if (!auctionId) redirect("/");
  if (!name || !email.includes("@")) back("Name and email, please.");
  if (amountCents === null) back("Put in a real amount.");

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { bids: true },
  });
  if (!auction) redirect("/");

  const rejection = rejectBid(auction, auction.bids, amountCents as number);
  if (rejection) back(rejection.reason);

  // Who we're about to outbid, captured before this bid lands.
  const losing = highBid(auction.bids);

  await prisma.bid.create({
    data: {
      auctionId,
      bidderEmail: email,
      bidderName: name,
      amountCents: amountCents as number,
    },
  });

  // Only the person who just lost the lead hears about it. Everyone else
  // stays quiet, which is the difference between an update and a nuisance.
  if (losing && losing.bidderEmail !== email) {
    const subs = await prisma.pushSubscription.findMany({
      where: { email: losing.bidderEmail },
    });
    if (subs.length > 0) {
      await sendToSubscriptions(subs, {
        title: "You've been outbid",
        body: `The drop is at ${formatCents(amountCents as number)} now.`,
        url: `/drop/${auctionId}`,
        tag: `auction-${auctionId}`,
      }).catch(() => {});
    }
  }

  revalidatePath(`/drop/${auctionId}`);
  redirect(`/drop/${auctionId}?bid=ok`);
}

/**
 * Starts a Stripe checkout for one pair. The item is not held until payment
 * lands — see the webhook, which is what flips it to sold.
 */
export async function checkoutAction(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) redirect("/");

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { shoe: true, seller: true },
  });

  if (!item) redirect("/");
  if (!isBuyableStatus(item.status)) {
    redirect(`/shoe/${itemId}?checkout=unavailable`);
  }
  if (!item.listPriceCents || item.listPriceCents <= 0) {
    redirect(`/shoe/${itemId}?checkout=noprice`);
  }
  if (!canTakePayments()) {
    redirect(`/shoe/${itemId}?checkout=off`);
  }
  if (!item.seller.stripeReady) {
    redirect(`/shoe/${itemId}?checkout=seller`);
  }

  const priceCents = item.listPriceCents;
  const shippingCents = item.seller.buyerShippingCents;
  const platformFeeCents = platformFeeFor(
    priceCents,
    item.seller.platformFeeBps,
  );

  // Whoever sent this shopper earns a cut of the margin. It's recorded on
  // the order rather than transferred by Stripe — see /app/network, where
  // what you owe each reseller is totalled up for you to pay out.
  const reseller = await referringReseller();
  const resellerCutCents =
    reseller && reseller.id !== item.sellerId
      ? referralCommissionCents(
          priceCents,
          item.costCents,
          reseller.commissionBps,
        )
      : 0;

  const ref = `WK-${randomBytes(4).toString("hex").toUpperCase()}`;

  const session = await createCheckoutSession({
    item,
    seller: item.seller,
    orderRef: ref,
    priceCents,
    shippingCents,
    platformFeeCents,
  });

  await prisma.order.create({
    data: {
      ref,
      itemId: item.id,
      sellerId: item.sellerId,
      buyerEmail: session.customer_details?.email ?? "",
      buyerName: session.customer_details?.name ?? "",
      subtotalCents: priceCents,
      shippingCents,
      totalCents: priceCents + shippingCents,
      platformFeeCents,
      resellerId: resellerCutCents > 0 ? reseller?.id : null,
      resellerCutCents,
      status: "PENDING",
      stripeSessionId: session.id,
    },
  });

  if (!session.url) {
    redirect(`/shoe/${itemId}?checkout=failed`);
  }
  redirect(session.url);
}

"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canTakePayments } from "@/lib/config";
import { isBuyableStatus } from "@/lib/constants";
import { createCheckoutSession, platformFeeFor } from "@/lib/stripe";
import { storePhoto, UploadError } from "@/lib/uploads";

// Actions a shopper can trigger. Nothing here requires a login.

export async function sizeAlertAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const size = String(formData.get("size") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!email || !size) redirect("/?alert=missing");

  // Signing up twice for the same size shouldn't create two rows.
  const existing = await prisma.sizeAlert.findFirst({
    where: { email, size },
  });

  if (existing) {
    await prisma.sizeAlert.update({
      where: { id: existing.id },
      data: { note: note || existing.note },
    });
  } else {
    await prisma.sizeAlert.create({
      data: { email, size, note: note || null },
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
  const ref = `SH-${randomBytes(4).toString("hex").toUpperCase()}`;

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
      status: "PENDING",
      stripeSessionId: session.id,
    },
  });

  if (!session.url) {
    redirect(`/shoe/${itemId}?checkout=failed`);
  }
  redirect(session.url);
}

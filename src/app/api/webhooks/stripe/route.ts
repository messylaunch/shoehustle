import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { hasStripeWebhook } from "@/lib/config";
import { stripe } from "@/lib/stripe";

// This is what actually confirms a sale. Without it orders sit at "awaiting
// payment" forever, so it has to be running before you take a real order.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasStripeWebhook) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature." }, { status: 400 });
  }

  // Signature verification needs the raw body, not the parsed JSON.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Signature check failed: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object);
      break;
    case "checkout.session.expired":
      await onCheckoutExpired(event.data.object);
      break;
    case "charge.refunded":
      await onRefunded(event.data.object);
      break;
    default:
      // Everything else is noise for now; acknowledge so Stripe stops retrying.
      break;
  }

  return NextResponse.json({ received: true });
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (!order) return;
  // Stripe retries webhooks, so this has to be safe to run twice.
  if (order.status !== "PENDING") return;

  const details = session.customer_details;
  const address = details?.address;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        buyerEmail: details?.email ?? order.buyerEmail,
        buyerName: details?.name ?? order.buyerName,
        shipLine1: address?.line1 ?? null,
        shipLine2: address?.line2 ?? null,
        shipCity: address?.city ?? null,
        shipState: address?.state ?? null,
        shipPostal: address?.postal_code ?? null,
        shipCountry: address?.country ?? null,
        taxCents: session.total_details?.amount_tax ?? 0,
        totalCents: session.amount_total ?? order.totalCents,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
      },
    }),
    // One pair, one buyer. Marking it sold here is what stops two people
    // buying the same 10.5 thirty seconds apart.
    prisma.inventoryItem.update({
      where: { id: order.itemId },
      data: { status: "SOLD", soldAt: new Date() },
    }),
  ]);
}

async function onCheckoutExpired(session: Stripe.Checkout.Session) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (!order || order.status !== "PENDING") return;

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "CANCELLED" },
  });
}

async function onRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!order) return;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    }),
    // The pair is yours again, so put it back in hand rather than leaving it
    // showing as sold on the shop.
    prisma.inventoryItem.update({
      where: { id: order.itemId },
      data: { status: "IN_HAND", soldAt: null },
    }),
  ]);
}

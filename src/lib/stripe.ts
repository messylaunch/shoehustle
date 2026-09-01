import "server-only";

import Stripe from "stripe";
import type { InventoryItem, Shoe, User } from "@prisma/client";
import { appUrl, hasStripeKeys } from "./config";
import { formatSize } from "./constants";
import { shoeName } from "./research";

// Stripe Connect, destination charges.
//
// The buyer pays the platform, the platform keeps its fee, Stripe moves the
// rest to the seller's connected account. Every seller — you included — has
// to finish Stripe's onboarding before money can reach them.

export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      "Checkout is off. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env file and restart.",
    );
    this.name = "StripeNotConfiguredError";
  }
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!hasStripeKeys) throw new StripeNotConfiguredError();
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  return client;
}

/**
 * Stripe Tax is off unless you turn it on, because enabling it before your
 * tax settings exist makes every checkout fail. See the settings page.
 */
export const taxEnabled = process.env.STRIPE_TAX_ENABLED === "true";

// ---------------------------------------------------------------------------
// Seller onboarding
// ---------------------------------------------------------------------------

/**
 * Creates the seller's connected account if they don't have one, then returns
 * a one-time onboarding link. Stripe hosts the form and collects the legal
 * name, SSN or EIN, date of birth, address and bank account — we never see
 * or store any of it.
 */
export async function onboardingLinkFor(user: User): Promise<string> {
  const s = stripe();
  let accountId = user.stripeAccountId;

  if (!accountId) {
    const account = await s.accounts.create({
      type: "express",
      email: user.email,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { userId: user.id },
    });
    accountId = account.id;
    const { prisma } = await import("./db");
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const link = await s.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/app/settings?stripe=retry`,
    return_url: `${appUrl}/app/settings?stripe=done`,
    type: "account_onboarding",
  });

  return link.url;
}

/**
 * Asks Stripe whether this seller can actually be paid yet, and caches the
 * answer. Onboarding often stalls halfway, so never assume it finished just
 * because someone clicked through.
 */
export async function refreshSellerStatus(user: User): Promise<boolean> {
  if (!user.stripeAccountId || !hasStripeKeys) return false;

  const account = await stripe().accounts.retrieve(user.stripeAccountId);
  const ready = Boolean(account.charges_enabled && account.payouts_enabled);

  if (ready !== user.stripeReady) {
    const { prisma } = await import("./db");
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeReady: ready },
    });
  }
  return ready;
}

/** What's still outstanding on a half-finished onboarding, in plain words. */
export async function onboardingBlockers(user: User): Promise<string[]> {
  if (!user.stripeAccountId || !hasStripeKeys) return [];
  const account = await stripe().accounts.retrieve(user.stripeAccountId);
  const due = account.requirements?.currently_due ?? [];
  return due.map(prettyRequirement);
}

function prettyRequirement(key: string): string {
  const map: Record<string, string> = {
    "individual.id_number": "Social security number",
    "individual.ssn_last_4": "Last four of your SSN",
    "individual.dob.day": "Date of birth",
    "individual.dob.month": "Date of birth",
    "individual.dob.year": "Date of birth",
    "individual.address.line1": "Home address",
    "individual.first_name": "Legal first name",
    "individual.last_name": "Legal last name",
    "individual.email": "Email address",
    "individual.phone": "Phone number",
    external_account: "Bank account for payouts",
    business_profile_url: "A website or social profile for the business",
    business_profile_mcc: "What you sell (business category)",
    tos_acceptance: "Accepting Stripe's terms",
  };
  return map[key] ?? key.replace(/[._]/g, " ");
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface CheckoutInput {
  item: InventoryItem & { shoe: Shoe };
  seller: User;
  orderRef: string;
  priceCents: number;
  shippingCents: number;
  platformFeeCents: number;
}

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<Stripe.Checkout.Session> {
  const { item, seller, orderRef, priceCents, shippingCents, platformFeeCents } =
    input;

  if (!seller.stripeAccountId || !seller.stripeReady) {
    throw new Error(
      "This seller hasn't finished Stripe onboarding, so they can't be paid yet.",
    );
  }

  const name = shoeName(item.shoe);
  const size = formatSize(item.size, item.sizeType);

  return stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: {
            name: `${name} — ${size}`,
            description: item.notes?.slice(0, 300) || undefined,
          },
        },
      },
    ],
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shippingCents, currency: "usd" },
          display_name: "Shipping",
        },
      },
    ],
    shipping_address_collection: { allowed_countries: ["US"] },
    phone_number_collection: { enabled: true },
    automatic_tax: taxEnabled ? { enabled: true } : undefined,
    payment_intent_data: {
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: seller.stripeAccountId },
      metadata: { orderRef, itemId: item.id },
    },
    metadata: { orderRef, itemId: item.id, sellerId: seller.id },
    client_reference_id: orderRef,
    success_url: `${appUrl}/checkout/success?ref=${orderRef}`,
    cancel_url: `${appUrl}/shoe/${item.id}?checkout=cancelled`,
  });
}

/** Basis points of a sale, rounded to whole cents. */
export function platformFeeFor(priceCents: number, feeBps: number): number {
  return Math.round((priceCents * feeBps) / 10_000);
}

// Feature switches.
//
// Everything external is optional. The app is fully usable with no keys at
// all — photo ID becomes "type it in yourself" and checkout becomes "message
// me to buy". Each flag has a `why` string so the UI can explain what's off
// and how to turn it on, rather than silently hiding a button.

export const appUrl =
  process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

export const hasStripeKeys = Boolean(
  process.env.STRIPE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
);

export const hasStripeWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

export const hasPushKeys = Boolean(
  process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
);

export interface FeatureStatus {
  key: string;
  name: string;
  on: boolean;
  /** What you lose while it's off. */
  without: string;
  /** Exactly what to do to switch it on. */
  howTo: string;
}

export function featureStatuses(): FeatureStatus[] {
  return [
    {
      key: "photo-id",
      name: "Photo shoe ID",
      on: hasAnthropicKey,
      without:
        "You type the brand, model and colorway in yourself. Everything else works the same.",
      howTo:
        "Get a key at console.anthropic.com, then put ANTHROPIC_API_KEY=sk-ant-... in your .env file and restart.",
    },
    {
      key: "checkout",
      name: "Card checkout",
      on: hasStripeKeys,
      without:
        "Shoe pages show a 'Message to buy' button instead of a checkout, and you close the sale the way you do now.",
      howTo:
        "Create a Stripe account, copy the test keys from dashboard.stripe.com/apikeys into STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, then restart.",
    },
    {
      key: "webhook",
      name: "Payment confirmation",
      on: hasStripeWebhook,
      without:
        "Orders would sit at 'awaiting payment' forever, because nothing tells the app the card cleared. Turn this on before you take a real order.",
      howTo:
        "Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and paste the whsec_... it prints into STRIPE_WEBHOOK_SECRET.",
    },
    {
      key: "push",
      name: "Push notifications",
      on: hasPushKeys,
      without:
        "Shoppers can still install the app to their home screen, but you can't ping them when their size lands — which is the whole point of them installing it.",
      howTo:
        "Run `npm run push:keys`, then paste the two values it prints into NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and restart.",
    },
  ];
}

/** True when the site can actually take money end to end. */
export function canTakePayments(): boolean {
  return hasStripeKeys && hasStripeWebhook;
}

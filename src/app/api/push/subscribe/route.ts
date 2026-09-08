import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasPushKeys } from "@/lib/config";

export const dynamic = "force-dynamic";

// Stores a browser's push subscription. Endpoints are unique per device, so
// re-subscribing from the same phone updates the row rather than adding one.

export async function POST(request: Request) {
  if (!hasPushKeys) {
    return NextResponse.json(
      { error: "Push isn't configured on this site." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { subscription, email } = body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    email?: string | null;
  };

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "That subscription is missing its keys." },
      { status: 400 },
    );
  }

  const cleanEmail =
    typeof email === "string" && email.includes("@")
      ? email.trim().toLowerCase()
      : null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, email: cleanEmail },
    update: {
      p256dh,
      auth,
      // Don't wipe a known email if they re-subscribe without typing it.
      ...(cleanEmail ? { email: cleanEmail } : {}),
      failedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { endpoint } = body as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "No endpoint." }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}

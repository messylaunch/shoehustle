import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { REFERRAL_COOKIE } from "@/lib/referral";

export const dynamic = "force-dynamic";

// A reseller's link: /r/josh
//
// This is a route handler rather than a page because it needs to set a
// cookie, and server components can't. It stamps who sent the shopper, then
// drops them on the normal shop — they see the whole catalogue, not a
// cut-down version, because the network sells each other's stock.

// Route files may only export handlers and route config, so the cookie name
// lives in src/lib/referral.ts and is imported here.
const REFERRAL_DAYS = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const url = new URL(request.url);

  const reseller = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true, active: true, isReseller: true },
  });

  // Unknown or switched-off handle: send them to the shop rather than a 404.
  // A dead link on a business card should still sell shoes.
  //
  // Built from the incoming request, not APP_URL — a card printed with the
  // right domain must not break because an env var says something else.
  const destination = new URL("/", url.origin);
  // Carry a size through, so "/r/josh?size=10.5" still lands filtered.
  const size = url.searchParams.get("size");
  if (size) destination.searchParams.set("size", size);

  const response = NextResponse.redirect(destination);

  if (reseller && reseller.active && reseller.isReseller) {
    response.cookies.set(REFERRAL_COOKIE, reseller.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REFERRAL_DAYS * 24 * 60 * 60,
    });
  }

  return response;
}

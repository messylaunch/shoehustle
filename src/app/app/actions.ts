"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { formatCents, parseBpsOr, parseCents, parseCentsOr } from "@/lib/money";
import { isValidHandle, normalizeHandle } from "@/lib/affiliate";
import { reserveMet } from "@/lib/auction";
import { hasPushKeys } from "@/lib/config";
import { notifySizeWatchers } from "@/lib/push";
import { suggestedOverall } from "@/lib/ratings";
import { identifyShoe, IdentifyUnavailableError } from "@/lib/identify";
import type { IdentifyResult } from "@/lib/identify";
import { filesFrom, storePhoto, UploadError } from "@/lib/uploads";
import { onboardingLinkFor, refreshSellerStatus } from "@/lib/stripe";
import { saveSettings } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Photo identification
// ---------------------------------------------------------------------------

export interface IdentifyState {
  status: "idle" | "ok" | "error";
  result?: IdentifyResult;
  /** Public URLs of the photos, carried forward onto the item once saved. */
  photoUrls?: string[];
  error?: string;
}

export async function identifyAction(
  _prev: IdentifyState,
  formData: FormData,
): Promise<IdentifyState> {
  await requireUser();

  const files = filesFrom(formData, "photos");
  if (files.length === 0) {
    return { status: "error", error: "Pick at least one photo first." };
  }

  try {
    const stored = await Promise.all(files.slice(0, 4).map(storePhoto));
    const result = await identifyShoe(
      stored.map((s) => ({ data: s.base64, mediaType: s.mediaType })),
      String(formData.get("hint") ?? ""),
    );
    return {
      status: "ok",
      result,
      photoUrls: stored.map((s) => s.url),
    };
  } catch (error) {
    if (error instanceof IdentifyUnavailableError || error instanceof UploadError) {
      return { status: "error", error: error.message };
    }
    return {
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong reading that photo.",
    };
  }
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/**
 * Creates the pair and takes you straight to its workbench, where the comps,
 * research links and max buy price live.
 */
export async function createItemAction(formData: FormData) {
  const user = await requireUser();

  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const colorway = String(formData.get("colorway") ?? "").trim();
  const styleCode = String(formData.get("styleCode") ?? "").trim().toUpperCase();
  const nickname = String(formData.get("nickname") ?? "").trim();
  const retailCents = parseCents(formData.get("retail"));

  const size = String(formData.get("size") ?? "").trim();
  const sizeType = String(formData.get("sizeType") ?? "M");
  const grade = String(formData.get("grade") ?? "G8");
  const costCents = parseCentsOr(formData.get("cost"), 0);
  const acquiredFrom = String(formData.get("acquiredFrom") ?? "").trim();
  const photoUrls = String(formData.get("photoUrls") ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  if (!brand || !model || !size) {
    redirect("/app/price?error=missing");
  }

  // A style code identifies the shoe, so reuse the catalog entry when we've
  // seen this model before rather than creating a duplicate.
  const shoe = styleCode
    ? await prisma.shoe.upsert({
        where: { styleCode },
        create: {
          brand,
          model,
          colorway: colorway || null,
          styleCode,
          nickname: nickname || null,
          retailCents,
        },
        update: {
          // Fill gaps on an existing entry without clobbering good data.
          colorway: colorway || undefined,
          nickname: nickname || undefined,
          retailCents: retailCents ?? undefined,
        },
      })
    : await prisma.shoe.create({
        data: {
          brand,
          model,
          colorway: colorway || null,
          nickname: nickname || null,
          retailCents,
        },
      });

  const item = await prisma.inventoryItem.create({
    data: {
      shoeId: shoe.id,
      sellerId: user.id,
      size,
      sizeType,
      grade,
      costCents,
      acquiredFrom: acquiredFrom || null,
      status: "SOURCING",
      photos: {
        create: photoUrls.map((url, sort) => ({ url, sort })),
      },
    },
  });

  revalidatePath("/app/inventory");
  redirect(`/app/inventory/${item.id}`);
}

export async function updateItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || (item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/inventory");
  }

  const status = String(formData.get("status") ?? item.status);
  const etaRaw = String(formData.get("restorationEta") ?? "").trim();

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      size: String(formData.get("size") ?? item.size).trim(),
      sizeType: String(formData.get("sizeType") ?? item.sizeType),
      grade: String(formData.get("grade") ?? item.grade),
      status,
      costCents: parseCentsOr(formData.get("cost"), item.costCents),
      listPriceCents: parseCents(formData.get("listPrice")),
      acquiredFrom: String(formData.get("acquiredFrom") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      marketNewCents: parseCents(formData.get("marketNew")),
      ...ratingFields(formData),
      // Checkbox groups arrive as repeated fields; store them comma-joined.
      flaws: formData.getAll("flaws").map(String).join(",") || null,
      flawNotes: String(formData.get("flawNotes") ?? "").trim() || null,
      treatments: formData.getAll("treatments").map(String).join(",") || null,
      restorationNotes:
        String(formData.get("restorationNotes") ?? "").trim() || null,
      restorationEta: etaRaw ? new Date(etaRaw) : null,
      // Stamp the sale date the first time something is marked sold, and the
      // listing date the first time it goes live, so ageing stock is findable.
      soldAt: status === "SOLD" ? (item.soldAt ?? new Date()) : null,
      listedAt:
        status === "LISTED" ? (item.listedAt ?? new Date()) : item.listedAt,
      holderId: String(formData.get("holderId") ?? "").trim() || null,
    },
  });

  revalidatePath(`/app/inventory/${id}`);
  revalidatePath("/app/inventory");
  revalidatePath("/");
  redirect(`/app/inventory/${id}?saved=1`);
}

export async function deleteItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { orders: true },
  });
  if (!item || (item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/inventory");
  }
  // Deleting a pair someone paid for would orphan the order record.
  if (item.orders.some((o) => o.status !== "PENDING")) {
    redirect(`/app/inventory/${id}?error=hasorders`);
  }

  await prisma.inventoryItem.delete({ where: { id } });
  revalidatePath("/app/inventory");
  redirect("/app/inventory");
}

export async function addPhotosAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { photos: true },
  });
  if (!item || (item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/inventory");
  }

  const files = filesFrom(formData, "photos");
  let sort = item.photos.length;

  for (const file of files.slice(0, 6)) {
    try {
      const stored = await storePhoto(file);
      await prisma.itemPhoto.create({
        data: { itemId: id, url: stored.url, sort: sort++ },
      });
    } catch (error) {
      if (!(error instanceof UploadError)) throw error;
    }
  }

  revalidatePath(`/app/inventory/${id}`);
  redirect(`/app/inventory/${id}`);
}

export async function deletePhotoAction(formData: FormData) {
  const user = await requireUser();
  const photoId = String(formData.get("photoId") ?? "");

  const photo = await prisma.itemPhoto.findUnique({
    where: { id: photoId },
    include: { item: true },
  });
  if (!photo || (photo.item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/inventory");
  }

  await prisma.itemPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/app/inventory/${photo.itemId}`);
  redirect(`/app/inventory/${photo.itemId}`);
}

/**
 * Pulls the grade card off the form. Each part is 1-5 or blank; the overall
 * falls back to the suggestion so a graded pair always has a number on it.
 */
function ratingFields(formData: FormData) {
  const part = (key: string): number | null => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  };

  const parts = {
    ratingUpper: part("ratingUpper"),
    ratingMidsole: part("ratingMidsole"),
    ratingOutsole: part("ratingOutsole"),
    ratingInsole: part("ratingInsole"),
    ratingSmell: part("ratingSmell"),
  };

  const typed = String(formData.get("ratingOverall") ?? "").trim();
  let overall: number | null = null;
  if (typed) {
    const value = Number(typed);
    if (Number.isFinite(value)) {
      overall = Math.max(1, Math.min(10, Math.round(value)));
    }
  } else {
    overall = suggestedOverall(parts);
  }

  return { ...parts, ratingOverall: overall };
}

// ---------------------------------------------------------------------------
// Comps
// ---------------------------------------------------------------------------

export async function addCompAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");

  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || (item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/inventory");
  }

  const priceCents = parseCents(formData.get("price"));
  if (priceCents === null || priceCents <= 0) {
    redirect(`/app/inventory/${itemId}?error=price`);
  }

  await prisma.comp.create({
    data: {
      itemId,
      shoeId: item.shoeId,
      source: String(formData.get("source") ?? "EBAY"),
      kind: String(formData.get("kind") ?? "SOLD"),
      priceCents,
      size: String(formData.get("size") ?? "").trim() || null,
      grade: String(formData.get("grade") ?? "").trim() || null,
      url: String(formData.get("url") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });

  revalidatePath(`/app/inventory/${itemId}`);
  redirect(`/app/inventory/${itemId}#comps`);
}

export async function deleteCompAction(formData: FormData) {
  const user = await requireUser();
  const compId = String(formData.get("compId") ?? "");

  const comp = await prisma.comp.findUnique({
    where: { id: compId },
    include: { item: true },
  });
  if (!comp?.item || (comp.item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/inventory");
  }

  await prisma.comp.delete({ where: { id: compId } });
  revalidatePath(`/app/inventory/${comp.itemId}`);
  redirect(`/app/inventory/${comp.itemId}#comps`);
}

/** Writes the calculator's estimates onto the pair so they survive a reload. */
export async function saveEstimatesAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");

  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || (item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/inventory");
  }

  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      estAsIsCents: parseCents(formData.get("estAsIs")),
      estCleanCents: parseCents(formData.get("estClean")),
      estRestoredCents: parseCents(formData.get("estRestored")),
    },
  });

  revalidatePath(`/app/inventory/${itemId}`);
  redirect(`/app/inventory/${itemId}?saved=1`);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveSellerSettingsAction(formData: FormData) {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: String(formData.get("name") ?? user.name).trim(),
      handle: String(formData.get("handle") ?? "").trim() || null,
      bio: String(formData.get("bio") ?? "").trim() || null,
      targetProfitCents: parseCentsOr(
        formData.get("targetProfit"),
        user.targetProfitCents,
      ),
      shipOutCents: parseCentsOr(formData.get("shipOut"), user.shipOutCents),
      cleanCostCents: parseCentsOr(formData.get("cleanCost"), user.cleanCostCents),
      restoreCostCents: parseCentsOr(
        formData.get("restoreCost"),
        user.restoreCostCents,
      ),
      buyerShippingCents: parseCentsOr(
        formData.get("buyerShipping"),
        user.buyerShippingCents,
      ),
    },
  });

  revalidatePath("/app/settings");
  redirect("/app/settings?saved=1");
}

export async function saveChannelAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const feeBps = parseBpsOr(formData.get("feePercent"), 0);
  const fixedFeeCents = parseCentsOr(formData.get("fixedFee"), 0);
  const isDefault = formData.get("isDefault") === "on";

  if (!name) redirect("/app/settings?error=channelname");

  if (isDefault) {
    await prisma.channel.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  if (id) {
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel || channel.userId !== user.id) redirect("/app/settings");
    await prisma.channel.update({
      where: { id },
      data: { name, feeBps, fixedFeeCents, isDefault },
    });
  } else {
    await prisma.channel.create({
      data: { userId: user.id, name, feeBps, fixedFeeCents, isDefault },
    });
  }

  revalidatePath("/app/settings");
  redirect("/app/settings?saved=1");
}

export async function deleteChannelAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel || channel.userId !== user.id) redirect("/app/settings");

  await prisma.channel.delete({ where: { id } });
  revalidatePath("/app/settings");
  redirect("/app/settings?saved=1");
}

export async function saveSiteSettingsAction(formData: FormData) {
  await requireAdmin();

  await saveSettings({
    shopName: String(formData.get("shopName") ?? "").trim(),
    tagline: String(formData.get("tagline") ?? "").trim(),
    contactLine: String(formData.get("contactLine") ?? "").trim(),
    contactUrl: String(formData.get("contactUrl") ?? "").trim(),
    restorationBlurb: String(formData.get("restorationBlurb") ?? "").trim(),
  });

  revalidatePath("/", "layout");
  redirect("/app/settings?saved=1");
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

export async function connectStripeAction() {
  const user = await requireUser();
  const url = await onboardingLinkFor(user);
  redirect(url);
}

export async function refreshStripeAction() {
  const user = await requireUser();
  await refreshSellerStatus(user);
  revalidatePath("/app/settings");
  redirect("/app/settings?stripe=checked");
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function markShippedAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || (order.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/orders");
  }

  await prisma.order.update({
    where: { id },
    data: {
      status: "SHIPPED",
      shippedAt: new Date(),
      trackingCarrier:
        String(formData.get("trackingCarrier") ?? "").trim() || null,
      trackingNumber:
        String(formData.get("trackingNumber") ?? "").trim() || null,
    },
  });

  revalidatePath("/app/orders");
  redirect("/app/orders?shipped=1");
}

// ---------------------------------------------------------------------------
// Restoration requests
// ---------------------------------------------------------------------------

export async function updateRequestAction(formData: FormData) {
  // Customer records, not seller records: admin only.
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const etaRaw = String(formData.get("etaDate") ?? "").trim();

  await prisma.restorationRequest.update({
    where: { id },
    data: {
      status: String(formData.get("status") ?? "NEW"),
      quoteCents: parseCents(formData.get("quote")),
      etaDate: etaRaw ? new Date(etaRaw) : null,
      internalNotes: String(formData.get("internalNotes") ?? "").trim() || null,
    },
  });

  revalidatePath("/app/leads");
  redirect("/app/leads?saved=1#requests");
}

export async function updateTradeInAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await prisma.tradeIn.update({
    where: { id },
    data: {
      status: String(formData.get("status") ?? "NEW"),
      offerCents: parseCents(formData.get("offer")),
      creditCents: parseCents(formData.get("credit")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath("/app/leads");
  redirect("/app/leads?saved=1#trades");
}

export async function markAlertNotifiedAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await prisma.sizeAlert.update({
    where: { id },
    data: { notifiedAt: new Date() },
  });

  revalidatePath("/app/leads");
  redirect("/app/leads#alerts");
}

// ---------------------------------------------------------------------------
// Sellers
// ---------------------------------------------------------------------------

export async function inviteSellerAction(formData: FormData) {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) redirect("/app/sellers?error=missing");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/app/sellers?error=exists");

  await prisma.invite.create({
    data: {
      code: randomBytes(9).toString("base64url"),
      email,
      name,
      role: "SELLER",
      createdById: admin.id,
    },
  });

  revalidatePath("/app/sellers");
  redirect("/app/sellers?invited=1");
}

export async function setSellerFeeAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  await prisma.user.update({
    where: { id },
    data: { platformFeeBps: parseBpsOr(formData.get("feePercent"), 0) },
  });

  revalidatePath("/app/sellers");
  redirect("/app/sellers?saved=1");
}

export async function toggleSellerActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) redirect("/app/sellers?error=self");

  const seller = await prisma.user.findUnique({ where: { id } });
  if (!seller) redirect("/app/sellers");

  await prisma.user.update({
    where: { id },
    data: { active: !seller.active },
  });
  // Switching someone off should also end their sessions.
  if (seller.active) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  revalidatePath("/app/sellers");
  redirect("/app/sellers?saved=1");
}

export async function revokeInviteAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.invite.delete({ where: { id } });
  revalidatePath("/app/sellers");
  redirect("/app/sellers");
}

/**
 * Turns someone into a reseller: gives them a handle for their link and sets
 * what share of the margin they earn.
 */
export async function setResellerAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isReseller = formData.get("isReseller") === "on";
  const rawHandle = String(formData.get("handle") ?? "");
  const handle = rawHandle.trim() ? normalizeHandle(rawHandle) : null;

  if (isReseller && (!handle || !isValidHandle(handle))) {
    redirect("/app/sellers?error=handle");
  }

  // Handles live in a URL, so two people can't share one.
  if (handle) {
    const clash = await prisma.user.findUnique({ where: { handle } });
    if (clash && clash.id !== id) redirect("/app/sellers?error=handletaken");
  }

  await prisma.user.update({
    where: { id },
    data: {
      isReseller,
      handle,
      commissionBps: parseBpsOr(formData.get("commissionPercent"), 3000),
    },
  });

  revalidatePath("/app/sellers");
  redirect("/app/sellers?saved=1");
}

// ---------------------------------------------------------------------------
// Pickup meets
// ---------------------------------------------------------------------------

export async function savePickupAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name || !address || !city) redirect("/app/pickups?error=missing");

  const data = {
    name,
    address,
    city,
    notes: String(formData.get("notes") ?? "").trim() || null,
    dayOfWeek: Number(formData.get("dayOfWeek") ?? 6),
    startTime: String(formData.get("startTime") ?? "18:00"),
    endTime: String(formData.get("endTime") ?? "19:30"),
    active: formData.get("active") === "on",
  };

  if (id) {
    const existing = await prisma.pickupLocation.findUnique({ where: { id } });
    if (!existing) redirect("/app/pickups");
    // An unowned spot is the shop's, so only an admin may touch it.
    const ownsIt = existing.holderId === user.id;
    if (!ownsIt && user.role !== "ADMIN") redirect("/app/pickups");
    await prisma.pickupLocation.update({ where: { id }, data });
  } else {
    await prisma.pickupLocation.create({
      data: { ...data, holderId: user.id },
    });
  }

  revalidatePath("/app/pickups");
  revalidatePath("/");
  redirect("/app/pickups?saved=1");
}

export async function deletePickupAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const spot = await prisma.pickupLocation.findUnique({
    where: { id },
    include: { orders: { take: 1 } },
  });
  if (!spot) redirect("/app/pickups");
  if (spot.holderId !== user.id && user.role !== "ADMIN") {
    redirect("/app/pickups");
  }
  // Orders point at it, so retire it rather than orphaning their history.
  if (spot.orders.length > 0) {
    await prisma.pickupLocation.update({
      where: { id },
      data: { active: false },
    });
    revalidatePath("/app/pickups");
    redirect("/app/pickups?retired=1");
  }

  await prisma.pickupLocation.delete({ where: { id } });
  revalidatePath("/app/pickups");
  redirect("/app/pickups");
}

/** Marks an order handed over at the meet. */
export async function markHandedOverAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const order = await prisma.order.findUnique({
    where: { id },
    include: { pickupLocation: true },
  });
  const isHolder = order?.pickupLocation?.holderId === user.id;
  if (
    !order ||
    (order.sellerId !== user.id && !isHolder && user.role !== "ADMIN")
  ) {
    redirect("/app/orders");
  }

  await prisma.order.update({
    where: { id },
    data: { status: "SHIPPED", handedOverAt: new Date(), shippedAt: new Date() },
  });

  revalidatePath("/app/orders");
  redirect("/app/orders?handed=1");
}

// ---------------------------------------------------------------------------
// The weekly drop
// ---------------------------------------------------------------------------

export async function createDropAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");

  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || (item.sellerId !== user.id && user.role !== "ADMIN")) {
    redirect("/app/drops?error=item");
  }

  const endsRaw = String(formData.get("endsAt") ?? "").trim();
  if (!endsRaw) redirect("/app/drops?error=ends");
  const endsAt = new Date(endsRaw);
  if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) {
    redirect("/app/drops?error=ends");
  }

  await prisma.auction.create({
    data: {
      itemId,
      title: String(formData.get("title") ?? "").trim() || null,
      startCents: parseCentsOr(formData.get("startPrice"), 2500),
      reserveCents: parseCents(formData.get("reserve")),
      incrementCents: parseCentsOr(formData.get("increment"), 500),
      endsAt,
    },
  });

  // A pair being auctioned shouldn't also be buyable at a fixed price.
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: { status: "RESERVED" },
  });

  revalidatePath("/app/drops");
  revalidatePath("/");
  redirect("/app/drops?created=1");
}

export async function closeDropAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { item: true, bids: true },
  });
  if (!auction) redirect("/app/drops");
  if (auction.item.sellerId !== user.id && user.role !== "ADMIN") {
    redirect("/app/drops");
  }

  const sold = reserveMet(auction, auction.bids);

  await prisma.$transaction([
    prisma.auction.update({
      where: { id },
      data: { status: "CLOSED" },
    }),
    // Sold goes to the winner off-app; unsold goes back on the shelf.
    prisma.inventoryItem.update({
      where: { id: auction.itemId },
      data: sold
        ? { status: "SOLD", soldAt: new Date() }
        : { status: "LISTED" },
    }),
  ]);

  revalidatePath("/app/drops");
  revalidatePath("/");
  redirect("/app/drops?closed=1");
}

export async function cancelDropAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { item: true },
  });
  if (!auction) redirect("/app/drops");
  if (auction.item.sellerId !== user.id && user.role !== "ADMIN") {
    redirect("/app/drops");
  }

  await prisma.$transaction([
    prisma.auction.update({ where: { id }, data: { status: "CANCELLED" } }),
    prisma.inventoryItem.update({
      where: { id: auction.itemId },
      data: { status: "LISTED" },
    }),
  ]);

  revalidatePath("/app/drops");
  revalidatePath("/");
  redirect("/app/drops");
}

// ---------------------------------------------------------------------------
// Telling people
// ---------------------------------------------------------------------------

/**
 * Pings only the people watching this pair's size. A blast to everyone about
 * a size they don't wear is how you get uninstalled.
 */
export async function notifySizeAction(formData: FormData) {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { shoe: true },
  });
  if (!item) redirect("/app/inventory");
  // This writes attacker-controllable text onto a stranger's lock screen, so
  // it has to be your own pair.
  if (item.sellerId !== user.id && user.role !== "ADMIN") {
    redirect("/app/inventory");
  }

  if (!hasPushKeys) {
    redirect(`/app/inventory/${itemId}?error=nopush`);
  }

  const result = await notifySizeWatchers(item.size, {
    title: `Your size just landed — ${item.size}`,
    body: `${[item.shoe.brand, item.shoe.model].filter(Boolean).join(" ")}${
      item.listPriceCents ? `, ${formatCents(item.listPriceCents)}` : ""
    }`,
    url: `/shoe/${item.id}`,
    tag: `item-${item.id}`,
  });

  redirect(`/app/inventory/${itemId}?notified=${result.sent}`);
}

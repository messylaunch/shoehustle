import "server-only";

import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";

export const REFERRAL_COOKIE = "wk_ref";

/**
 * The reseller who sent this shopper, if any. Read on the shop pages so the
 * banner shows who they're shopping with, and at checkout so the commission
 * lands on the right person.
 */
export async function referringReseller(): Promise<User | null> {
  const jar = await cookies();
  const id = jar.get(REFERRAL_COOKIE)?.value;
  if (!id) return null;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.active || !user.isReseller) return null;
  return user;
}

import "server-only";

import { prisma } from "./db";

// Site-wide settings. Key/value so adding one doesn't need a migration.

export interface SiteSettings {
  shopName: string;
  tagline: string;
  contactLine: string;
  /** Where "Message to buy" points when checkout is off. */
  contactUrl: string;
  restorationBlurb: string;
}

// The name is a starting point, not a decision you're stuck with — change
// any of this on /app/settings without touching code.
const DEFAULTS: SiteSettings = {
  shopName: "Well Kept",
  tagline: "Secondhand sneakers, properly looked after. Find your size.",
  contactLine: "Message me and I'll get back to you the same day.",
  contactUrl: "",
  restorationBlurb:
    "Got a pair you love that's seen better days? Send me photos and I'll quote you a clean, a restore, or tell you honestly if it isn't worth it.",
};

export async function getSettings(): Promise<SiteSettings> {
  // The root layout reads this, so a database that isn't there yet — during a
  // build, or before the first `npm run setup` — must not take the whole app
  // down. Fall back to the defaults and carry on.
  const rows = await prisma.setting.findMany().catch(() => []);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    shopName: map.get("shopName") || DEFAULTS.shopName,
    tagline: map.get("tagline") || DEFAULTS.tagline,
    contactLine: map.get("contactLine") || DEFAULTS.contactLine,
    contactUrl: map.get("contactUrl") ?? DEFAULTS.contactUrl,
    restorationBlurb: map.get("restorationBlurb") || DEFAULTS.restorationBlurb,
  };
}

export async function saveSettings(values: Partial<SiteSettings>): Promise<void> {
  const entries = Object.entries(values).filter(
    ([, value]) => value !== undefined,
  ) as [string, string][];

  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );
}

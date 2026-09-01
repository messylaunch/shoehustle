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

const DEFAULTS: SiteSettings = {
  shopName: "Shoe Hustle",
  tagline: "Cleaned, restored and deadstock pairs. Find your size.",
  contactLine: "Message me and I'll get back to you the same day.",
  contactUrl: "",
  restorationBlurb:
    "Got a pair you love that's seen better days? Send me photos and I'll quote you a clean, a restore, or tell you honestly if it isn't worth it.",
};

export async function getSettings(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany();
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

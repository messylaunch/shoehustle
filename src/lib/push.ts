import "server-only";

import webpush from "web-push";
import { prisma } from "./db";
import { appUrl, hasPushKeys } from "./config";

// Web push. No third-party service and no app store — the browser does it,
// which is why the storefront is a PWA rather than a native app.
//
// Subscriptions die all the time (cleared site data, reinstalled browser).
// A 404 or 410 from the push service means gone for good, so those rows get
// deleted rather than retried forever.

let configured = false;

function configure() {
  if (configured || !hasPushKeys) return;
  webpush.setVapidDetails(
    appUrl.startsWith("http") ? appUrl : `https://${appUrl}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping the notification takes them. */
  url?: string;
  /** Collapses older notifications with the same tag. */
  tag?: string;
}

export interface PushResult {
  sent: number;
  removed: number;
  failed: number;
}

/** Sends to specific subscriptions, cleaning up dead ones as it goes. */
export async function sendToSubscriptions(
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[],
  message: PushMessage,
): Promise<PushResult> {
  if (!hasPushKeys) return { sent: 0, removed: 0, failed: subscriptions.length };
  configure();

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? "/",
    tag: message.tag,
  });

  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser is gone. Stop trying.
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
          removed++;
        } else {
          await prisma.pushSubscription
            .update({ where: { id: sub.id }, data: { failedAt: new Date() } })
            .catch(() => {});
          failed++;
        }
      }
    }),
  );

  return { sent, removed, failed };
}

/** Everyone who's installed the app. */
export async function broadcast(message: PushMessage): Promise<PushResult> {
  const subs = await prisma.pushSubscription.findMany();
  return sendToSubscriptions(subs, message);
}

/**
 * Just the people watching a given size. This is the one that matters — a
 * blast to everyone about a size they don't wear is how you get uninstalled.
 */
export async function notifySizeWatchers(
  size: string,
  message: PushMessage,
): Promise<PushResult> {
  const alerts = await prisma.sizeAlert.findMany({
    where: { size },
    select: { email: true },
  });
  const emails = [...new Set(alerts.map((a) => a.email))];
  if (emails.length === 0) return { sent: 0, removed: 0, failed: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { email: { in: emails } },
  });
  return sendToSubscriptions(subs, message);
}

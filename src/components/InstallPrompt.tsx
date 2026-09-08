"use client";

import { useEffect, useState } from "react";

// Install + notifications, in one card on the storefront.
//
// Chrome and Android fire `beforeinstallprompt`, so they get a real button.
// iOS Safari has no such event and never will — it needs the Share sheet —
// so it gets instructions instead of a button that wouldn't work.

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * The VAPID public key arrives as URL-safe base64; the push API wants raw
 * bytes. Backed by an explicit ArrayBuffer so it satisfies BufferSource.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export default function InstallPrompt({
  vapidKey,
  shopName,
}: {
  vapidKey: string | null;
  shopName: string;
}) {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [pushState, setPushState] = useState<
    "unsupported" | "idle" | "working" | "on" | "denied" | "error"
  >("idle");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Register the worker up front; push subscription needs it ready.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS reports installed apps through a non-standard property.
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setInstalled(standalone);

    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));

    if (!("Notification" in window) || !("PushManager" in window)) {
      setPushState("unsupported");
    } else if (Notification.permission === "denied") {
      setPushState("denied");
    } else if (Notification.permission === "granted") {
      // Granted doesn't mean subscribed — check for a live subscription.
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushState(sub ? "on" : "idle"))
        .catch(() => setPushState("idle"));
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  async function enablePush() {
    if (!vapidKey) return;
    setPushState("working");
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "idle");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          email: email.trim() || null,
        }),
      });

      if (!response.ok) throw new Error("save failed");

      setPushState("on");
      setMessage(
        email.trim()
          ? "Done. I'll ping you when something lands in the sizes you're watching."
          : "Done. Add your size below and I'll only ping you about sizes you actually wear.",
      );
    } catch {
      setPushState("error");
      setMessage("That didn't take. Try again, or just check back.");
    }
  }

  // Nothing useful to offer: already installed and already subscribed.
  if (installed && pushState === "on") {
    return (
      <div className="notice notice-good">
        <strong>You&apos;re all set</strong>
        <span className="small">
          {shopName} is on your home screen and notifications are on. I&apos;ll
          only message you about sizes you&apos;re watching.
        </span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Put {shopName} on your phone</h3>
      <p className="small muted">
        Stock moves fast and pairs are one-of-one — when your size lands
        there&apos;s usually only one of them. Installing takes a second and
        means you hear about it first.
      </p>

      {!installed ? (
        installEvent ? (
          <button className="btn btn-primary" type="button" onClick={install}>
            Add to home screen
          </button>
        ) : isIos ? (
          <div className="notice notice-info">
            <strong>On iPhone</strong>
            <span className="small">
              Tap the Share button at the bottom of Safari, then{" "}
              <strong>Add to Home Screen</strong>. Notifications only work once
              it&apos;s been added.
            </span>
          </div>
        ) : (
          <p className="small muted">
            Use your browser menu and choose <strong>Install</strong> or{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        )
      ) : null}

      {vapidKey && pushState !== "unsupported" ? (
        <div style={{ marginTop: installed ? 0 : "1rem" }}>
          {pushState === "on" ? (
            <p className="small" style={{ color: "var(--good)", marginBottom: 0 }}>
              Notifications are on.
            </p>
          ) : pushState === "denied" ? (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Notifications are blocked for this site in your browser settings.
              You can still use the size list below.
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="push-email">
                  Email (so I only ping you about your sizes)
                </label>
                <input
                  id="push-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <button
                className="btn"
                type="button"
                onClick={enablePush}
                disabled={pushState === "working"}
              >
                {pushState === "working" ? "Just a second…" : "Turn on alerts"}
              </button>
            </>
          )}
          {message ? (
            <p className="small" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

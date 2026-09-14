import "server-only";
import webpush from "web-push";
import type { PushSubscription } from "./types";

// Web Push (VAPID) — delivers a browser/OS notification to a logged-in
// admin's device even when the admin tab isn't open, via public/sw.js.
// Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY; without them this is a
// no-op so the rest of the app works unchanged.
export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails("mailto:ceejay.spaxx.ocampo@gmail.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidConfigured = true;
}

export type PushPayload = { title: string; body: string; url: string };

// Sends to every given subscription in parallel; a subscription the push
// service reports as gone (410) or unknown (404) is expired — its endpoint
// is returned so the caller can delete that row instead of retrying it
// forever. Any other per-subscription failure (offline device, transient
// network error) is swallowed — that device just misses this one alert.
export async function sendPushToUsers(subscriptions: PushSubscription[], payload: PushPayload): Promise<{ expiredEndpoints: string[] }> {
  if (!pushConfigured() || subscriptions.length === 0) return { expiredEndpoints: [] };
  ensureVapid();

  const body = JSON.stringify(payload);
  const expiredEndpoints: string[] = [];
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (err) {
        const statusCode = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : 0;
        if (statusCode === 404 || statusCode === 410) expiredEndpoints.push(sub.endpoint);
      }
    })
  );
  return { expiredEndpoints };
}

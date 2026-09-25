import "server-only";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Firebase Cloud Messaging — delivers a notification to the native
// admin/technician/rider apps (Capacitor + @capacitor/push-notifications).
// A Capacitor app's WKWebView can't receive standard Web Push the way a
// browser tab can, so lib/push.ts's VAPID web push never reaches those
// apps; FCM (relayed to APNs on iOS) is the channel that does. Separate
// from web push on purpose — a user can have both a push_subscriptions row
// (browser/PWA) and an fcm_tokens row (native app) and gets notified on
// whichever they actually have installed.
//
// Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
// (a Firebase service account — Project Settings > Service Accounts >
// Generate New Private Key in the Firebase console); without them this is a
// no-op so the rest of the app works unchanged.
export function fcmConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

function ensureApp() {
  if (getApps().length > 0) return;
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel/most env-var UIs can't store real newlines — the key is
      // pasted with literal "\n" escapes and unescaped here.
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export type FcmPayload = { title: string; body: string; url: string; badgeCount?: number };

// Sends to every given token in one batched call; a token FCM reports as
// unregistered/invalid is expired — returned so the caller can delete that
// row instead of retrying it forever. Any other per-token failure is
// swallowed, same as sendPushToUsers.
export async function sendFcmToUsers(tokens: string[], payload: FcmPayload): Promise<{ expiredTokens: string[] }> {
  if (!fcmConfigured() || tokens.length === 0) return { expiredTokens: [] };
  ensureApp();

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: { url: payload.url },
    apns: {
      payload: {
        aps: {
          badge: payload.badgeCount,
          sound: "default",
        },
      },
    },
  });

  const expiredTokens: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success && (r.error?.code === "messaging/registration-token-not-registered" || r.error?.code === "messaging/invalid-registration-token")) {
      expiredTokens.push(tokens[i]);
    }
  });
  return { expiredTokens };
}

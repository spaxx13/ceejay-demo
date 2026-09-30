import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Lazily initialized so a missing/misconfigured env var only breaks push
// sends, not every server action that happens to import this module.
function messaging() {
  if (getApps().length === 0) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!json) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
    initializeApp({ credential: cert(JSON.parse(json)) });
  }
  return getMessaging();
}

// Low-level FCM send, shared by the customer app and the staff apps
// (Admin, and later Technician/Rider) — takes tokens rather than looking
// them up itself, so this module has no dependency on lib/db.ts (which
// calls back into here from notifyAdminsCore, and a two-way import would
// create a circular dependency). Callers fetch tokens for whichever
// audience they're sending to and prune whatever comes back as expired.
//
// `url` is a path within the app (e.g. "/admin/requests/<id>") sent as a
// data payload — StaffPushNotificationRegistrar.tsx/PushNotificationRegistrar.tsx
// listen for the tap and navigate there. Without it, tapping a notification
// just opens the app to wherever it happened to be, not the relevant page.
export async function sendPushToTokens(tokens: string[], title: string, body: string, url?: string): Promise<{ expiredTokens: string[] }> {
  if (tokens.length === 0) return { expiredTokens: [] };

  const m = messaging();
  const expiredTokens: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      try {
        await m.send({
          token,
          notification: { title, body },
          data: url ? { url } : undefined,
          apns: { payload: { aps: { sound: "default" } } },
        });
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
        if (code === "messaging/registration-token-not-registered") expiredTokens.push(token);
        else console.error("[sendPushToTokens]", token.slice(0, 12), code || err);
      }
    }),
  );
  return { expiredTokens };
}

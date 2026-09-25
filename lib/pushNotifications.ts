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
export async function sendPushToTokens(tokens: string[], title: string, body: string): Promise<{ expiredTokens: string[] }> {
  if (tokens.length === 0) return { expiredTokens: [] };

  const results = await messaging().sendEach(
    tokens.map((token) => ({
      token,
      notification: { title, body },
      apns: { payload: { aps: { sound: "default" } } },
    })),
  );

  const expiredTokens = results.responses
    .map((r, i) => (!r.success && r.error?.code === "messaging/registration-token-not-registered" ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  return { expiredTokens };
}

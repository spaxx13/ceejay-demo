import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getCustomerPushTokens, deleteCustomerPushToken } from "./db";

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

// Sends to every device the customer has registered (usually one). A token
// that FCM reports as no-longer-registered (app uninstalled, etc.) is
// pruned so future sends don't keep retrying it.
export async function sendCustomerPush(customerId: string, title: string, body: string) {
  const tokens = await getCustomerPushTokens(customerId);
  if (tokens.length === 0) return;

  const results = await messaging().sendEach(
    tokens.map((token) => ({
      token,
      notification: { title, body },
      apns: { payload: { aps: { sound: "default" } } },
    })),
  );

  await Promise.all(
    results.responses.map((r, i) =>
      !r.success && r.error?.code === "messaging/registration-token-not-registered" ? deleteCustomerPushToken(tokens[i]) : Promise.resolve(),
    ),
  );
}

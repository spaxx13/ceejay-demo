import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// PayMongo (paymongo.com) — Philippines payment gateway, used for the
// public ₱10 iCloud ON/OFF checker's GCash/card checkout, and for the
// Laguna/Batangas/Pampanga Home Service down payment's QR Ph checkout.
// Requires a real PayMongo account; PAYMONGO_SECRET_KEY and
// PAYMONGO_WEBHOOK_SECRET must both be set for either feature to work end
// to end (the secret key to create/retrieve checkout sessions, the webhook
// secret to verify PayMongo's callback is genuinely from PayMongo).
const API_BASE = "https://api.paymongo.com/v1";

export function paymongoConfigured() {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

function secretKey() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set");
  return key;
}

// PayMongo's own auth scheme: HTTP Basic with the secret key as the
// username and an empty password.
function authHeader() {
  return "Basic " + Buffer.from(`${secretKey()}:`).toString("base64");
}

// The only place peso<->centavo conversion happens — PayMongo's API is
// centavo-integer only, but every money field elsewhere in this app
// (RepairRecord.cost, Expense.amount, IcloudCheck.amount, ...) is a plain
// peso number. Nothing outside this file should ever see a centavo value.
export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}
export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

export type CreateCheckoutSessionInput = {
  // Stashed in the session so the webhook (app/api/webhooks/paymongo) can
  // map the PayMongo event back to whatever this checkout was for —
  // `kind` picks which of our tables/rows the rest of the fields identify.
  metadata: Record<string, string>;
  amountPesos: number;
  description: string;
  lineItemName: string;
  paymentMethodTypes?: ("gcash" | "card" | "qrph")[]; // defaults to gcash+card
  successUrl: string;
  cancelUrl: string;
};
export type CheckoutSession = { id: string; checkoutUrl: string };

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
  const res = await fetch(`${API_BASE}/checkout_sessions`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              currency: "PHP",
              amount: pesosToCentavos(input.amountPesos),
              description: input.description,
              name: input.lineItemName,
              quantity: 1,
            },
          ],
          payment_method_types: input.paymentMethodTypes ?? ["gcash", "card"],
          description: input.description,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata,
        },
      },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.data?.id || !data?.data?.attributes?.checkout_url) {
    throw new Error(`PayMongo checkout session creation failed (${res.status})`);
  }
  return { id: data.data.id, checkoutUrl: data.data.attributes.checkout_url };
}

export type CheckoutSessionStatus = { id: string; paid: boolean; paymentId: string | null };

// Used by the result page's fallback re-verification path — if the
// webhook hasn't landed yet by the time the customer's browser returns
// from PayMongo, this asks PayMongo directly instead of leaving the
// customer stuck on a "pending" screen.
//
// NOTE: derives "paid" from a non-empty `attributes.payments` array,
// which is how PayMongo's docs describe a completed Checkout Session —
// worth confirming against a real sandbox response once live keys exist,
// since exact nested field names occasionally shift between PayMongo API
// versions.
export async function retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionStatus> {
  const res = await fetch(`${API_BASE}/checkout_sessions/${sessionId}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.data?.id) throw new Error(`PayMongo checkout session lookup failed (${res.status})`);

  const payments: Array<{ id: string; attributes?: { status?: string } }> = data.data.attributes?.payments ?? [];
  const paidPayment = payments.find((p) => p.attributes?.status === "paid") ?? payments[0];
  return { id: data.data.id, paid: payments.length > 0, paymentId: paidPayment?.id ?? null };
}

// Verifies PayMongo's `Paymongo-Signature` header: `t=<unix ts>,te=<test
// hmac>,li=<live hmac>`. The signed payload is `${t}.${rawBody}`, HMAC-SHA256
// with PAYMONGO_WEBHOOK_SECRET. Only one of te/li will ever match our
// configured secret (test vs live) — checking both means this works
// whichever mode the configured secret is for, without needing to know
// which mode we're in ahead of time. rawBody MUST be the exact,
// unparsed request body text — never re-derived from a parsed JSON object,
// since re-serializing can change whitespace/key order and break the
// signature.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const timestamp = parts.t;
  if (!timestamp) return false;

  const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  for (const candidate of [parts.te, parts.li]) {
    if (!candidate || candidate.length !== expected.length) continue;
    try {
      if (timingSafeEqual(expectedBuf, Buffer.from(candidate, "hex"))) return true;
    } catch {
      // length/format mismatch — not a match, keep checking the other candidate
    }
  }
  return false;
}

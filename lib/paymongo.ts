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

export type PaymentMethodType =
  | "gcash"
  | "grab_pay"
  | "card"
  | "qrph"
  | "dob"
  | "dob_ubp"
  | "brankas_bdo"
  | "brankas_landbank"
  | "brankas_metrobank"
  | "brankas_rcbc"
  | "paymaya"
  | "shopee_pay";

// Active on the PayMongo dashboard, but the exact Checkout Session
// `payment_method_types` code is unverified (best guesses). If one of these is
// wrong, PayMongo either ignores it (earlier "brankas" did) or rejects the
// whole request — the retry in createCheckoutSession covers the second case so
// a bad guess can never stop a customer from paying. Remove a code from here
// once it is confirmed to show up on a real checkout page.
const UNCONFIRMED_PAYMENT_METHODS: ReadonlySet<PaymentMethodType> = new Set(["paymaya", "shopee_pay", "brankas_rcbc"]);

export type CreateCheckoutSessionInput = {
  // Stashed in the session so the webhook (app/api/webhooks/paymongo) can
  // map the PayMongo event back to whatever this checkout was for —
  // `kind` picks which of our tables/rows the rest of the fields identify.
  metadata: Record<string, string>;
  amountPesos: number;
  description: string;
  lineItemName: string;
  // defaults to gcash+grab_pay+paymaya+shopee_pay+card. Bank redirect options, confirmed against a
  // real checkout session (the plain "brankas" this used to list was
  // silently ignored by PayMongo — no error, it just never showed up):
  // "dob" is BPI only, UnionBank needs its own "dob_ubp", and each
  // Brankas-backed bank needs its own "brankas_<bank>" code — no combined
  // "brankas" value exists. "paymaya", "shopee_pay" and "brankas_rcbc" are
  // Active on the PayMongo dashboard but their Checkout Session codes are NOT
  // confirmed — see UNCONFIRMED_PAYMENT_METHODS, which createCheckoutSession
  // drops and retries without if PayMongo rejects the request.
  paymentMethodTypes?: PaymentMethodType[];
  successUrl: string;
  cancelUrl: string;
};
export type CheckoutSession = { id: string; checkoutUrl: string };

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
  const requested: PaymentMethodType[] = input.paymentMethodTypes ?? ["gcash", "grab_pay", "paymaya", "shopee_pay", "card"];

  async function attempt(methods: PaymentMethodType[]) {
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
            payment_method_types: methods,
            description: input.description,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            metadata: input.metadata,
          },
        },
      }),
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  }

  let { res, data } = await attempt(requested);
  if (!res.ok) {
    const confirmed = requested.filter((m) => !UNCONFIRMED_PAYMENT_METHODS.has(m));
    if (confirmed.length > 0 && confirmed.length < requested.length) {
      ({ res, data } = await attempt(confirmed));
    }
  }
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
// A non-empty `attributes.payments` array means a payment was *attempted*
// against this session, not that it succeeded — a failed or cancelled
// attempt (e.g. a bank redirect that errors out before completing) still
// shows up there with its own status. Confirmed live: a customer's failed
// BDO attempt left a non-empty payments array, which an earlier version
// of this function (checking only payments.length > 0) read as "paid" and
// wrongly confirmed a booking nobody had actually paid for. Only a
// payment whose own status is "paid" counts.
export async function retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionStatus> {
  const res = await fetch(`${API_BASE}/checkout_sessions/${sessionId}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.data?.id) throw new Error(`PayMongo checkout session lookup failed (${res.status})`);

  const payments: Array<{ id: string; attributes?: { status?: string } }> = data.data.attributes?.payments ?? [];
  const paidPayment = payments.find((p) => p.attributes?.status === "paid");
  return { id: data.data.id, paid: !!paidPayment, paymentId: paidPayment?.id ?? null };
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

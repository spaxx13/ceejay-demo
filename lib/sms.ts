import "server-only";

// SMS via Semaphore (semaphore.co) — a Philippines-focused SMS gateway.
// Requires a real Semaphore account and SEMAPHORE_API_KEY set in the
// environment; nothing here works without it. SEMAPHORE_SENDER_NAME is
// optional — a registered custom sender name, falling back to Semaphore's
// default if unset.
const API_BASE = "https://api.semaphore.co/api/v4";

export function smsConfigured() {
  return Boolean(process.env.SEMAPHORE_API_KEY);
}

function apiKey() {
  const key = process.env.SEMAPHORE_API_KEY;
  if (!key) throw new Error("SEMAPHORE_API_KEY is not set");
  return key;
}

// Semaphore expects a PH mobile number — accepts what the rest of the app
// already validates (isValidPhone: "0" or "+63" + 9 + 9 digits) and
// normalizes it to the 09XXXXXXXXX form. Exported so callers can use the
// exact same normalized string as an otp_codes lookup key, regardless of
// which of the two accepted forms the customer originally typed.
export function normalizePhone(phone: string) {
  const digits = phone.replace(/[\s-]/g, "");
  if (digits.startsWith("+63")) return "0" + digits.slice(3);
  if (digits.startsWith("63") && digits.length === 12) return "0" + digits.slice(2);
  return digits;
}

type SemaphoreMessage = { message_id: number; status: string; code?: string };

function buildBody(phone: string, message: string) {
  const body = new URLSearchParams({ apikey: apiKey(), number: normalizePhone(phone), message });
  const senderName = process.env.SEMAPHORE_SENDER_NAME;
  if (senderName) body.set("sendername", senderName);
  return body;
}

// Sends through Semaphore's dedicated OTP route (routed to a carrier path
// prioritized for OTP traffic) — Semaphore generates the actual code and
// hands it back in the response; the caller hashes and stores it exactly
// like the old email-OTP flow did, so verification logic is unchanged.
export async function sendOtpSms(phone: string): Promise<string> {
  const body = buildBody(
    phone,
    "Your Ceejay Cellphone Repair Shop verification code is {otp}. Valid for 10 minutes — don't share this with anyone."
  );
  const res = await fetch(`${API_BASE}/otp`, { method: "POST", body });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(`Semaphore OTP send failed (${res.status})`);
  const first: SemaphoreMessage = Array.isArray(data) ? data[0] : data;
  if (!first?.code) throw new Error("Semaphore did not return a code");
  return String(first.code);
}

// General-purpose notification SMS (request confirmation, technician
// assignment, status updates, appointment reminders) — standard route, not
// the OTP-dedicated one.
export async function sendSms(phone: string, message: string): Promise<void> {
  const res = await fetch(`${API_BASE}/messages`, { method: "POST", body: buildBody(phone, message) });
  if (!res.ok) throw new Error(`Semaphore SMS send failed (${res.status})`);
}

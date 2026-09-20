import "server-only";

// SICKW.com — third-party IMEI/serial lookup reseller, used here only for
// the "iCloud ON/OFF" (Find My iPhone) check behind the public ₱10
// checker. Requires a real SICKW account and SICKW_API_KEY.
//
// ============================================================
// TODO(pre-launch): CONFIRM AGAINST THE SICKW DASHBOARD'S "API ACCESS"
// DOCS BEFORE GOING LIVE. Everything below in this block is built against
// the common request shape for this class of reseller API (a GET request
// with the key/imei/service as query params, JSON response) — it has NOT
// been verified against SICKW's actual documented endpoint, param names,
// or the real service ID for "iCloud ON/OFF". Edit ONLY this block once
// the real API example is available; nothing below it should need to
// change.
// ============================================================
const SICKW_BASE_URL = "https://sickw.com/api.php";
const SICKW_PARAM_NAMES = { apiKey: "key", imei: "imei", service: "service", format: "format" };
// The numeric/string service ID SICKW assigns to "iCloud ON/OFF" — the
// screenshot of the dashboard showed it priced as "0.02 - iCLOUD ON/OFF"
// in a picker, but that's a price+label, not necessarily the id string
// this param expects. SICKW_SERVICE_ID lets it be overridden via env
// without a code change once confirmed.
const SICKW_SERVICE_ID = process.env.SICKW_SERVICE_ID || "PLACEHOLDER_ICLOUD_ON_OFF_SERVICE_ID";

function buildSickwUrl(imei: string): string {
  const params = new URLSearchParams({
    [SICKW_PARAM_NAMES.apiKey]: apiKey(),
    [SICKW_PARAM_NAMES.imei]: imei,
    [SICKW_PARAM_NAMES.service]: SICKW_SERVICE_ID,
    [SICKW_PARAM_NAMES.format]: "json",
  });
  return `${SICKW_BASE_URL}?${params.toString()}`;
}

// Best-effort extraction of an ON/OFF/UNKNOWN verdict from whatever JSON
// SICKW actually returns. Returns null (not a thrown error) when the
// shape isn't recognized, so the caller can still persist the raw
// response for a human to look at instead of losing it.
function parseSickwResponse(json: unknown): { icloudStatus: "ON" | "OFF" | "UNKNOWN"; summary: string } | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const resultText = typeof obj.result === "string" ? obj.result : typeof obj.response === "string" ? obj.response : null;
  if (!resultText) return null;

  const lower = resultText.toLowerCase();
  const icloudStatus: "ON" | "OFF" | "UNKNOWN" = /\bon\b/.test(lower) && !/\boff\b/.test(lower) ? "ON" : /\boff\b/.test(lower) ? "OFF" : "UNKNOWN";
  return { icloudStatus, summary: resultText.trim() };
}
// ============================================================
// END of the block that needs confirming against real SICKW docs.
// ============================================================

export function sickwConfigured() {
  return Boolean(process.env.SICKW_API_KEY);
}

function apiKey() {
  const key = process.env.SICKW_API_KEY;
  if (!key) throw new Error("SICKW_API_KEY is not set");
  return key;
}

export type SickwCheckResult =
  | { ok: true; icloudStatus: "ON" | "OFF" | "UNKNOWN"; summary: string; rawResponse: unknown }
  | { ok: false; error: string; rawResponse: unknown | null };

// Deliberately never throws (unlike lib/email.ts/lib/sms.ts's throw-on-
// failure convention) — a customer has already paid by the time this
// runs, so every outcome, including a malformed/unexpected response, must
// come back as data the caller can persist and act on rather than an
// exception that could leave the payment in limbo.
export async function checkIcloudStatus(imei: string): Promise<SickwCheckResult> {
  if (!sickwConfigured()) return { ok: false, error: "SICKW_API_KEY is not set", rawResponse: null };

  let res: Response;
  try {
    res = await fetch(buildSickwUrl(imei), { cache: "no-store" });
  } catch (err) {
    return { ok: false, error: `Couldn't reach SICKW (${err instanceof Error ? err.message : "network error"})`, rawResponse: null };
  }

  const rawResponse = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: `SICKW request failed (${res.status})`, rawResponse };
  }
  if (rawResponse === null) {
    return { ok: false, error: "SICKW returned a non-JSON response", rawResponse: null };
  }

  const parsed = parseSickwResponse(rawResponse);
  if (!parsed) {
    return { ok: false, error: "Unrecognized SICKW response shape — check rawResponse and fix parseSickwResponse in lib/sickw.ts", rawResponse };
  }
  return { ok: true, icloudStatus: parsed.icloudStatus, summary: parsed.summary, rawResponse };
}

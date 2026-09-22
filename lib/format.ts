// The shop is Philippines-only (all branches in Metro Manila / Bulacan), so
// every displayed date/time is pinned to Philippine time regardless of
// which timezone the server process actually runs in — local dev runs in
// Asia/Manila already, but Vercel's serverless runtime defaults to UTC,
// which silently shifted every timestamp shown on the deployed site.
const TIME_ZONE = "Asia/Manila";

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-US", { timeZone: TIME_ZONE });
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", { timeZone: TIME_ZONE });
}

export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
}

// "en-CA" formats as YYYY-MM-DD, matching the date strings request rows
// are already truncated to (see toDateStr in lib/db.ts), so this can be
// compared directly against r.preferredDatetime.
export function todayDateStr(): string {
  return toManilaDateStr(new Date());
}

// A timestamptz's own ".slice(0, 10)" gives its UTC calendar date, not its
// Asia/Manila one — for anything before 8:00 AM Manila that's still the
// previous UTC day, so a naive slice silently drops early-morning rows from
// a "today" filter compared against todayDateStr(). Use this instead
// whenever a timestamp (not a plain date column) needs to be compared
// against a Manila calendar date.
export function toManilaDateStr(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Branches open at 6:00 AM — check-in before that is refused (see checkIn,
// lib/actions.ts) and the widget hides the form rather than let someone tap
// a button that will just silently no-op. hourCycle: "h23" is required —
// "hour12: false" alone can format midnight as "24" instead of "00"
// depending on the ICU data, which would wrongly read as check-in-open.
export const CHECK_IN_OPEN_HOUR = 6;
export function isCheckInOpen(now: Date = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour >= CHECK_IN_OPEN_HOUR;
}

// Admin enters a local PH mobile number ("09xxxxxxxxx"), but WhatsApp
// (wa.me) and Viber deep links both need it in international form with no
// leading zero ("639xxxxxxxxx"). Strips everything but digits first so a
// number typed with spaces/dashes, or already in "+639..."/"639..." form,
// still comes out right.
export function toPhInternational(localNumber: string): string {
  const digits = localNumber.replace(/\D/g, "");
  if (digits.startsWith("63")) return digits;
  if (digits.startsWith("0")) return `63${digits.slice(1)}`;
  return `63${digits}`;
}

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
  return new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
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

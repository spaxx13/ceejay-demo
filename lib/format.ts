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

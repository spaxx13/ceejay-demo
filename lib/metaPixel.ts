// Safe wrapper around the Meta Pixel's fbq() — a no-op when the Pixel isn't
// loaded (ad blockers, the Pixel turned off, server-side rendering).
type Fbq = (command: "track" | "trackCustom", event: string, params?: Record<string, unknown>) => void;

export function trackMetaEvent(event: string, params?: Record<string, unknown>, custom = false) {
  if (typeof window === "undefined") return;
  try {
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    fbq?.(custom ? "trackCustom" : "track", event, params);
  } catch {
    // Tracking must never break the booking flow.
  }
}

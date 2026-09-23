// Shared rules for live "technician on the way" tracking — used by the
// server actions that start tracking / accept GPS updates, the public
// /track-technician page, and its polling API route.

// The request_status labels are admin-editable lookups (Admin > Statuses),
// so "on the way" is matched by label, accepting either wording.
export function isOnTheWayStatus(label: string | undefined) {
  const l = (label ?? "").trim().toLowerCase();
  return l === "en route" || l === "on the way";
}

// Once work has started (or finished) the technician has arrived.
export function isArrivedStatus(label: string | undefined) {
  const l = (label ?? "").trim().toLowerCase();
  return l === "in progress" || l === "completed";
}

export type TrackingPhase = "scheduled" | "on_the_way" | "arrived" | "cancelled";

export function trackingPhase(label: string | undefined): TrackingPhase {
  if (isOnTheWayStatus(label)) return "on_the_way";
  if (isArrivedStatus(label)) return "arrived";
  if ((label ?? "").trim().toLowerCase() === "cancelled") return "cancelled";
  return "scheduled";
}

// Shape returned by GET /api/track-technician/[token] and passed to the
// tracking page's client view. Deliberately minimal: the token only
// unlocks the customer's own pin and the technician's live position.
export type TrackingSnapshot = {
  reference: string;
  phase: TrackingPhase;
  technicianName: string;
  customer: { lat: number; lng: number } | null;
  technician: { lat: number; lng: number } | null;
  technicianUpdatedAt: string | null;
};

// Google Maps turn-by-turn link to the customer's pin, for the technician.
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// Straight-line distance in km between two points.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Rough ETA for the customer: straight-line distance padded for real roads,
// at an average Metro Manila riding speed. Shown as an estimate only.
const ROAD_FACTOR = 1.4;
const AVG_SPEED_KMH = 25;
export function estimateEta(technician: { lat: number; lng: number }, customer: { lat: number; lng: number }) {
  const km = distanceKm(technician, customer) * ROAD_FACTOR;
  return { km, minutes: Math.max(1, Math.ceil((km / AVG_SPEED_KMH) * 60)) };
}

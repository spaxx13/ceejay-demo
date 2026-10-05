import { distanceKm } from "./technicianTracking";

// Per-province flat home service fee — shared between the client form
// (components/HomeServiceForm.tsx, for the on-page notice) and the server
// action (lib/actions.ts, for the Sunday-only enforcement and the
// quotation email's Service Fee line), so neither can drift from the other.
// Some provinces carry a higher fee for towns farther from the metro —
// `higherTowns`/`higherFee` cover that; provinces with neither (or not
// listed at all) just show the flat `base` rate, or no fee at all if the
// province isn't in this map.
export const PROVINCE_FEES: Record<string, { base: number; higherTowns?: string[]; higherFee?: number }> = {
  "Metro Manila": { base: 500 },
  Bulacan: {
    base: 700,
    higherTowns: ["Angat", "Norzagaray", "Doña Remedios Trinidad", "Santa Maria", "San Rafael", "San Ildefonso", "San Miguel"],
    higherFee: 1000,
  },
  Cavite: {
    base: 700,
    higherTowns: ["Indang", "Amadeo", "Maragondon", "Tagaytay City", "Alfonso", "Silang", "Ternate"],
    higherFee: 1000,
  },
  Pampanga: { base: 1000 },
  Laguna: { base: 1000 },
  Batangas: { base: 1000 },
  Rizal: {
    base: 500,
    higherTowns: ["Tanay", "Baras", "Cardona", "Pililla", "Morong"],
    higherFee: 800,
  },
};

// These provinces only get a home service visit once a week — the
// Preferred Date field is restricted to Sundays only when one of them is
// selected.
export const SUNDAY_ONLY_PROVINCES = new Set(["Pampanga", "Laguna", "Batangas"]);

// Repair types that require in-branch equipment/parts we don't bring on a
// home visit — kept out of the options a customer can pick for a home
// service booking (real /request form) or a Home Service quote (/quote).
// They're still listed on the public Services page and the in-branch
// POS/checklist flow, just not bookable/quotable as a home service.
//
// "Back Glass" (glass-only, needs a separation machine) is excluded here in
// favor of "Backglass (Whole Shell Including Glass)" — the simpler
// whole-shell swap technicians can actually do on-site.
export const EXCLUDED_FROM_HOME_SERVICE = new Set([
  "Camera",
  "Back Glass",
  "Logic board problem",
  "Charging Port",
  "Front Camera",
  "Camera Lens",
  "Reglass",
]);

// Repair types the owner doesn't take through Pickup & Delivery — kept off
// that booking form's dropdown (components/HomeServiceForm.tsx), rejected
// server-side (submitHomeServiceRequest) and sent to the native app. Still
// bookable as Home Service / walk-in where applicable. Note "Camera" is
// the generic entry; "Back camera replacement" / "Front Camera" stay.
export const EXCLUDED_FROM_PICKUP_DELIVERY = new Set(["Screen Repair", "Battery Replacement", "Camera"]);

// These provinces require a QR Ph down payment (via PayMongo), equal to
// the service fee, before the booking can be confirmed — see
// startHomeServiceDownpayment/processHomeServiceDownpayment in
// lib/actions.ts. Currently the same three provinces as
// SUNDAY_ONLY_PROVINCES above, but kept as its own set since the two rules
// (weekly visit scheduling vs. down payment policy) are separate business
// decisions that only happen to share the same provinces today.
export const DOWNPAYMENT_PROVINCES = new Set(["Laguna", "Batangas", "Pampanga"]);

// Pickup & Delivery's Booking, Diagnostic & Delivery Fee — one upfront QR Ph
// payment (same PayMongo down-payment flow as DOWNPAYMENT_PROVINCES above)
// covering the pickup trip, the initial diagnosis and delivery back, so the
// customer knows the full cost before booking and there's no second payment
// near delivery time. Tiered by how far the pickup address is from the
// nearest branch: straight-line between the customer's map pin and the
// branch's pin (Admin > Branches), scaled by PICKUP_DELIVERY_ROAD_FACTOR to
// approximate the real road trip. No upper cap — 11 km and beyond is
// simply the top tier. Coverage area: PICKUP_DELIVERY_COVERAGE below.
export const PICKUP_DELIVERY_ROAD_FACTOR = 1.3;

// Where riders actually go: all of Metro Manila, plus the three Rizal
// towns right next to it. `cities: null` = every city/municipality in that
// province; otherwise only the listed ones (names as in
// public/ph-addresses-near.json, e.g. "City of Antipolo"). Shared by the
// web form (trims the address picker), the submit action (server-side
// backstop) and the native app's config bundle.
export const PICKUP_DELIVERY_COVERAGE: { provinceKey: string; province: string; cities: string[] | null }[] = [
  { provinceKey: "metro_manila", province: "Metro Manila", cities: null },
  { provinceKey: "rizal", province: "Rizal", cities: ["Cainta", "City of Antipolo", "Taytay"] },
];
export const PICKUP_DELIVERY_COVERAGE_LABEL = "Metro Manila, plus Cainta, Antipolo, and Taytay in Rizal";

// Rough outline of the same coverage area as a lat/lng polygon, for the
// map pin: the province/city dropdowns say where the customer *claims* to
// be, this checks where the pin actually is (a map search for "Tanay" once
// landed a pin in Laguna and quoted 45 km). Hand-traced, clockwise from
// Valenzuela, around Metro Manila's edge and out east over Antipolo; good
// to within a km or two, which is all a "clearly outside" guard needs.
export const PICKUP_DELIVERY_COVERAGE_POLYGON: { lat: number; lng: number }[] = [
  { lat: 14.78, lng: 120.93 }, // Valenzuela / Caloocan NW
  { lat: 14.79, lng: 121.06 }, // Caloocan North
  { lat: 14.76, lng: 121.12 }, // Quezon City NE (La Mesa)
  { lat: 14.73, lng: 121.18 }, // Antipolo north
  { lat: 14.72, lng: 121.3 }, // Antipolo NE
  { lat: 14.56, lng: 121.3 }, // Antipolo SE
  { lat: 14.52, lng: 121.2 }, // Antipolo south
  { lat: 14.53, lng: 121.13 }, // Taytay (Laguna de Bay shore)
  { lat: 14.49, lng: 121.1 }, // Taguig east
  { lat: 14.44, lng: 121.08 }, // Taguig south
  { lat: 14.36, lng: 121.05 }, // Muntinlupa south
  { lat: 14.36, lng: 120.99 }, // Muntinlupa SW
  { lat: 14.42, lng: 120.96 }, // Las Piñas west
  { lat: 14.5, lng: 120.95 }, // Parañaque coast
  { lat: 14.6, lng: 120.95 }, // Manila coast
  { lat: 14.7, lng: 120.92 }, // Navotas / Valenzuela coast
];
// Bounding box of the polygon — what the address search is limited to.
export const PICKUP_DELIVERY_SEARCH_BOUNDS = { south: 14.36, west: 120.92, north: 14.79, east: 121.3 };

export function pointInPickupDeliveryCoverage(lat: number, lng: number): boolean {
  // Standard ray-casting point-in-polygon.
  const poly = PICKUP_DELIVERY_COVERAGE_POLYGON;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].lat, xi = poly[i].lng, yj = poly[j].lat, xj = poly[j].lng;
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
export function pickupDeliveryCovers(province: string, city: string): boolean {
  const entry = PICKUP_DELIVERY_COVERAGE.find((c) => c.province === province);
  if (!entry) return false;
  return entry.cities === null || entry.cities.includes(city);
}
export const PICKUP_DELIVERY_FEE_TIERS: { maxKm: number | null; fee: number }[] = [
  { maxKm: 5, fee: 500 },
  { maxKm: 10, fee: 700 },
  { maxKm: 15, fee: 800 },
  { maxKm: 20, fee: 1000 },
  { maxKm: 25, fee: 1200 },
  { maxKm: 30, fee: 1400 },
  { maxKm: null, fee: 1600 },
];
export const PICKUP_DELIVERY_FEE_MIN_PESOS = PICKUP_DELIVERY_FEE_TIERS[0].fee;
export const PICKUP_DELIVERY_FEE_MAX_PESOS = PICKUP_DELIVERY_FEE_TIERS[PICKUP_DELIVERY_FEE_TIERS.length - 1].fee;
export const PICKUP_DELIVERY_FEE_TIER_LABEL =
  "1–5 km ₱500 · 6–10 km ₱700 · 11–15 km ₱800 · 16–20 km ₱1,000 · 21–25 km ₱1,200 · 26–30 km ₱1,400 · 31+ km ₱1,600";

export function pickupDeliveryFeeForKm(roadKm: number): number {
  for (const tier of PICKUP_DELIVERY_FEE_TIERS) {
    if (tier.maxKm === null || roadKm <= tier.maxKm) return tier.fee;
  }
  return PICKUP_DELIVERY_FEE_MAX_PESOS;
}

export type PickupDeliveryQuote = { branchId: string; branchName: string; km: number; fee: number };

// Nearest pinned branch to a pinned pickup address, with the estimated
// road distance and the fee tier it lands in — null when either side has
// no pin (the form then shows the fee range and asks for a pin; the server
// falls back to the base tier). Shared by the public form (live preview)
// and submitHomeServiceRequest (the authoritative amount).
export function pickupDeliveryQuote(
  customer: { lat: number | null; lng: number | null },
  branches: { id: string; name: string; lat: number | null; lng: number | null }[]
): PickupDeliveryQuote | null {
  if (customer.lat === null || customer.lng === null || !Number.isFinite(customer.lat) || !Number.isFinite(customer.lng)) return null;
  let best: PickupDeliveryQuote | null = null;
  for (const b of branches) {
    if (b.lat === null || b.lng === null || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
    const km = Math.round(distanceKm({ lat: customer.lat, lng: customer.lng }, { lat: b.lat, lng: b.lng }) * PICKUP_DELIVERY_ROAD_FACTOR * 10) / 10;
    // Belt and braces: a NaN distance (bad coordinates) must never become a
    // "NaN km" quote — skip the branch instead.
    if (!Number.isFinite(km)) continue;
    if (!best || km < best.km) best = { branchId: b.id, branchName: b.name, km, fee: pickupDeliveryFeeForKm(km) };
  }
  return best;
}

// Local calendar date (YYYY-MM-DD) for a Date, using its local getters
// throughout — unlike `d.toISOString().slice(0, 10)`, this can't roll the
// date backward/forward across midnight for a customer whose local time
// isn't UTC (e.g. late-evening PH bookings would otherwise land on the
// wrong day once shifted to UTC).
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Strictly the UPCOMING Sunday — even when today already is a Sunday, this
// still skips ahead a full week rather than returning today. A technician
// needs lead time to get ready for a visit, so a customer filling out the
// form on a Sunday shouldn't be able to book a visit for that very day.
export function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((7 - d.getDay()) % 7) || 7));
  return localDateStr(d);
}

// Earliest Preferred Date the customer can pick, right now — a booking made
// at/after 6 PM is too late notice for a same-day visit, so it's bumped to
// tomorrow instead of leaving today (already half over) selectable.
const LATE_BOOKING_CUTOFF_HOUR = 18;
export function minPreferredDateStr(): string {
  const d = new Date();
  if (d.getHours() >= LATE_BOOKING_CUTOFF_HOUR) d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

// The actual flat fee (in pesos) for a given province/city, or null if the
// province isn't in PROVINCE_FEES at all.
export function serviceFeeAmount(province: string, city: string): number | null {
  const fee = PROVINCE_FEES[province];
  if (!fee) return null;
  if (fee.higherTowns && fee.higherFee && city && fee.higherTowns.includes(city)) return fee.higherFee;
  return fee.base;
}

// The "sticker price" service fee for this booking — what it would cost
// regardless of whether it's actually been waived (Admin > Requests > Waive
// Service Fee). Used both by requestServiceFee below (the fee the customer
// actually pays) and by Sales/Earnings reports that need to know how much a
// currently-waived fee originally would have been, to correctly exclude it
// from a job whose stored labor_cost/laborCost predates the waiver.
export function quotedServiceFee(req: {
  province: string;
  city: string;
  fulfillmentMode: "on_site" | "pickup_delivery";
  pickupDeliveryFeePesos?: number | null;
  downpaymentAmount?: number | null;
}): number {
  // The distance-tiered fee computed at booking; older bookings (before
  // the column existed) only have the amount they paid, or the base tier.
  if (req.fulfillmentMode === "pickup_delivery") return req.pickupDeliveryFeePesos ?? req.downpaymentAmount ?? PICKUP_DELIVERY_FEE_MIN_PESOS;
  return serviceFeeAmount(req.province, req.city) ?? 0;
}

// The service fee this specific booking's customer actually pays, in pesos
// — what the Post-Repair checklist adds to the Repair Price for the
// customer-facing Total Amount (lib/actions.ts submitChecklist /
// updateAgreementPrice). Derived from the request the customer filled out,
// never typed by the technician: the province/city visit fee for an
// on-site visit, the flat Pickup & Delivery fee for that mode, and ₱0 when
// staff waived the fee (Admin > Requests > Waive Service Fee).
export function requestServiceFee(req: {
  province: string;
  city: string;
  serviceFeeWaived: boolean;
  fulfillmentMode: "on_site" | "pickup_delivery";
  pickupDeliveryFeePesos?: number | null;
  downpaymentAmount?: number | null;
}): number {
  if (req.serviceFeeWaived) return 0;
  return quotedServiceFee(req);
}

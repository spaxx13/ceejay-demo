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
export const EXCLUDED_FROM_HOME_SERVICE = new Set([
  "Camera",
  "Backhousing(Whole shell including backglass)",
  "Logic board problem",
  "Charging Port",
  "Front Camera",
  "Camera Lens",
  "Reglass",
]);

// These provinces require a QR Ph down payment (via PayMongo), equal to
// the service fee, before the booking can be confirmed — see
// startHomeServiceDownpayment/processHomeServiceDownpayment in
// lib/actions.ts. Currently the same three provinces as
// SUNDAY_ONLY_PROVINCES above, but kept as its own set since the two rules
// (weekly visit scheduling vs. down payment policy) are separate business
// decisions that only happen to share the same provinces today.
export const DOWNPAYMENT_PROVINCES = new Set(["Laguna", "Batangas", "Pampanga"]);

// Pickup & Delivery's flat Booking/Pickup Fee + Initial/Diagnostic Fee +
// Delivery Fee (see the FINAL FLOW spec), paid via the same PayMongo QR Ph
// down-payment flow as DOWNPAYMENT_PROVINCES above before the booking is
// confirmed and a rider can be assigned. Flat rather than looked up from
// PROVINCE_FEES since Pickup & Delivery is Metro Manila-only regardless of
// city. The Delivery Fee is collected upfront here too (same one-time
// payment) rather than as a separate charge when the repaired device goes
// back out, so the customer knows the full cost before booking and there's
// no second payment step to chase down near delivery time.
export const PICKUP_DELIVERY_BOOKING_FEE_PESOS = 150;
export const PICKUP_DELIVERY_DIAGNOSTIC_FEE_PESOS = 200;
export const PICKUP_DELIVERY_DELIVERY_FEE_PESOS = 150;
export const PICKUP_DELIVERY_FEE_PESOS =
  PICKUP_DELIVERY_BOOKING_FEE_PESOS + PICKUP_DELIVERY_DIAGNOSTIC_FEE_PESOS + PICKUP_DELIVERY_DELIVERY_FEE_PESOS;

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

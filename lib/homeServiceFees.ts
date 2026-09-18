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
};

// These provinces only get a home service visit once a week — the
// Preferred Date field is restricted to Sundays only when one of them is
// selected.
export const SUNDAY_ONLY_PROVINCES = new Set(["Pampanga", "Laguna", "Batangas"]);

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

export function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
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

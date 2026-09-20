// Couriers customers can ship with. We deliberately don't integrate with
// any courier's API — the customer (and staff, for the return leg) just
// types the tracking number, and the tracking page links out to the
// courier's own site to look it up.
export const COURIERS = [
  { id: "jnt", label: "J&T Express", url: "https://www.jtexpress.ph" },
  { id: "lbc", label: "LBC Express", url: "https://www.lbcexpress.com" },
  { id: "flash", label: "Flash Express", url: "https://www.flashexpress.ph" },
  { id: "ninjavan", label: "Ninja Van", url: "https://www.ninjavan.co" },
  { id: "spx", label: "SPX Express (Shopee Xpress)", url: "https://spx.ph" },
  { id: "2go", label: "2GO Express", url: "https://express.2go.com.ph" },
  { id: "apcargo", label: "AP Cargo", url: "https://www.apcargo.com.ph" },
] as const;

export const OTHER_COURIER_ID = "other";

// Stored courier values are the human label ("J&T Express"), or the free-typed
// name for "Other", so rows stay readable without a lookup.
export function resolveCourierLabel(courierId: string, otherText: string): string {
  if (courierId === OTHER_COURIER_ID) return otherText.trim();
  return COURIERS.find((c) => c.id === courierId)?.label ?? "";
}

export function courierUrl(label: string): string | null {
  return COURIERS.find((c) => c.label === label)?.url ?? null;
}

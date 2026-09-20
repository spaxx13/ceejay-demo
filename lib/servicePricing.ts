// Pure functions, no server-only APIs — imported both server-side (Home
// Service booking, admin request detail) and client-side (the public Get a
// Quote form's live price preview), so this deliberately isn't "server-only".
import type { PriceCategory, ServicePrice } from "./types";

// Which of the four price categories a given service_type label draws
// from — two labels intentionally share "backhousing" and two share
// "back_camera" (owner confirmed both variants of each use the same price
// list). This mapping is a fixed structural rule, not something the owner
// edits — the actual prices (Admin > Settings > Repair Pricing, stored in
// the service_prices table) are what's editable.
export function priceCategoryForServiceType(serviceTypeLabel: string): PriceCategory | null {
  if (serviceTypeLabel === "Battery Replacement") return "battery";
  if (serviceTypeLabel === "Backhousing(Whole shell including backglass)" || serviceTypeLabel === "Back Housing (whole shell)") {
    return "backhousing";
  }
  if (serviceTypeLabel === "Camera" || serviceTypeLabel === "Back camera replacement") return "back_camera";
  if (serviceTypeLabel === "Screen Repair") return "screen";
  return null;
}

// Returns the estimated repair cost in pesos, or null when there's no
// price on file for this exact (service type, device model[, quality])
// combination — callers should show "confirmed after inspection" in that
// case rather than a number.
export function getRepairQuote(
  prices: ServicePrice[],
  serviceTypeLabel: string,
  deviceModelId: string,
  screenQuality?: string
): number | null {
  const category = priceCategoryForServiceType(serviceTypeLabel);
  if (!category || !deviceModelId) return null;
  const quality = category === "screen" ? (screenQuality === "original" ? "original" : screenQuality === "high_quality" ? "high_quality" : "") : "";
  if (category === "screen" && !quality) return null;
  const row = prices.find((p) => p.category === category && p.deviceModelId === deviceModelId && p.quality === quality);
  return row ? row.price : null;
}

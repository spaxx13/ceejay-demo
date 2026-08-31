import type { ChecklistItem } from "./types";

// The shop's paper "Post-Repair Checklist" (Section II of the Service
// Agreement), digitized row for row. `key` must stay stable — it's how a
// ServiceAgreement's saved item results map back to this template. Fixed
// legal/QA document, not admin-editable — kept in code, not the database.
export const CHECKLIST_TEMPLATE: Omit<ChecklistItem, "result" | "notes">[] = [
  { key: "lcd_function", label: "LCD Function (if repaired)", helpText: "Check for responsiveness, dead pixels, abnormal colors, touch issues" },
  { key: "battery_function", label: "Battery Function (if repaired)", helpText: "Check charging, discharge, and reported health" },
  { key: "charging_function", label: "Charging Function (if repaired)", helpText: "Test charging with charger" },
  { key: "front_camera", label: "Front Camera", helpText: "Test photo and video functionality" },
  { key: "back_camera", label: "Back Camera", helpText: "Test photo and video functionality, flash" },
  { key: "wifi_network", label: "Wi-Fi Network", helpText: "Test connection to a known Wi-Fi network" },
  { key: "power_volume", label: "Power/Volume Trigger", helpText: "Test all buttons for responsiveness" },
  { key: "microphone", label: "Microphone (Call/Voice Memo)", helpText: "Test during a call or voice recording" },
  { key: "physical_condition", label: "Overall Physical Condition", helpText: "Check for new damage or changes from pre-repair condition" },
  { key: "system_errors", label: "Parts-Fit / Liquid Damage / Other System Errors", helpText: "System error showing up on the device" },
];

// Verbatim from the shop's printed Service Agreement, Section III.
export const SERVICE_AGREEMENT_TERMS = [
  "Warranty Coverage: The warranty only covers the items that were repaired. Other issues beyond what was repaired are not covered.",
  "Increased Risk for Bloated Battery/OLED-Frame Separation: For bloated battery and OLED/Frame damage, the technician is not liable for any damage during the repair. These conditions increase the risk of OLED damage. If the customer agrees to proceed with the repair, Ceejay Apple Services is not liable for any damage to the LCD.",
  "Customer Responsibility (Post-Repair): It is the customer's responsibility to ensure that the iPhone is functioning and has no damage after the repair. Once the customer signs off the post-repair checklist, Ceejay Apple Services is not liable for any damage after the service.",
  "Timely Reporting of Issues: It is the customer's responsibility to report any issues promptly.",
  "LCD/OLED Replacement Warranty: LCD/OLED repair has a 3-day warranty for ghost touch or non-responsive issues only. Any bleeding, crack, lines, or physical damage is not covered under any warranty, as this is a result of the owner's mishandling.",
  "Battery Warranty: One-month warranty for quick discharge issue (3 hours or less at 100% charge). Bloated and other issues caused by misuse, over-charging, or use of chargers not intended for iPhone use are not covered.",
];

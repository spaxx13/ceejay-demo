import type { CustomFormField, DeviceModel, HomeServiceRequest, LookupItem } from "@/lib/types";

// What the customer filled in on the booking form, flattened to label/value
// rows — shown to admins (Admin > Pickup & Delivery > job) and riders
// (/rider and the Rider app) so they know what was picked up and what is to
// be repaired. Mirrors the "Request Details" block of Admin > Home Service
// Requests, minus the address/contact rows each screen already has.
export type BookingDetailRow = { label: string; value: string };

export function bookingDetailRows(
  req: Pick<
    HomeServiceRequest,
    "deviceBrandId" | "deviceModelId" | "deviceOther" | "serviceTypeId" | "screenQuality" | "backHousingColor" | "issueDescription" | "customFields"
  >,
  lookups: LookupItem[],
  deviceModels: DeviceModel[],
  customFormFields: CustomFormField[]
): BookingDetailRow[] {
  const brand = lookups.find((l) => l.id === req.deviceBrandId);
  const model = deviceModels.find((m) => m.id === req.deviceModelId);
  const serviceType = lookups.find((l) => l.id === req.serviceTypeId);
  const rows: BookingDetailRow[] = [];
  const device = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : req.deviceOther;
  if (device) rows.push({ label: "Device", value: device });
  if (serviceType?.label) rows.push({ label: "Service Needed", value: serviceType.label });
  if (req.screenQuality) rows.push({ label: "Screen Quality", value: req.screenQuality === "original" ? "Original" : "High Quality (compatible)" });
  if (req.backHousingColor) rows.push({ label: "Back Glass Color", value: req.backHousingColor });
  if (req.issueDescription) rows.push({ label: "Problem / Issue", value: req.issueDescription });
  for (const [key, value] of Object.entries(req.customFields ?? {})) {
    const field = customFormFields.find((f) => f.key === key);
    if (!field) continue;
    const text = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "").trim();
    if (text) rows.push({ label: field.label, value: text });
  }
  return rows;
}

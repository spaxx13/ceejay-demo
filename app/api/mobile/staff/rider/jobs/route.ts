import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { getBranches, getCustomFormFields, getDeviceModels, getLookups, getRequests, getRiderById, pickupDeliveryStage } from "@/lib/db";
import { bookingDetailRows } from "@/lib/bookingDetails";
import { pickupDeliveryFeeSummary } from "@/lib/homeServiceFees";
import { PICKUP_CONDITION_TEMPLATE, type CustomFormField, type DeviceModel, type HomeServiceRequest, type LookupItem } from "@/lib/types";

// The rider's My Jobs board as JSON — a mirror of app/rider/page.tsx: the
// on-duty flag, active branches, and the two legs scoped exactly as the
// page scopes them (a pickup isn't done until the device is at the shop; a
// delivery until it's delivered). Per-job flags/labels are precomputed here
// so the app renders the same badges and default status the web card does.
// Condition checklist rows/results and photo slots mirror
// components/DeviceConditionFields.tsx.
const CONDITION_RESULT_OPTIONS = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "N/A" },
];
const PHOTO_SLOTS = [
  { key: "front", label: "Front", required: true },
  { key: "back", label: "Back", required: true },
  { key: "left", label: "Left Side", required: true },
  { key: "right", label: "Right Side", required: true },
  { key: "top", label: "Top", required: true },
  { key: "bottom", label: "Bottom", required: true },
  { key: "damage", label: "Damaged Area(s) (if any)", required: false },
];
const RIDER_EXCEPTION_KINDS = [
  { value: "reschedule", label: "Customer Unavailable (Reschedule)" },
  { value: "contact_attempted", label: "Can't Find Customer" },
  { value: "flag_damage", label: "Additional Damage Found" },
  { value: "incident", label: "Safety Incident" },
  { value: "stop_review", label: "Wrong Customer / Device" },
  { value: "stop_delivery", label: "Wrong Unit — Stop Delivery" },
];
const PICKUP_STATUS_OPTIONS = [
  { value: "on_the_way", label: "On The Way" },
  { value: "picked_up", label: "Picked Up", needsSignature: true, needsConditionCheck: true },
  { value: "heading_to_shop", label: "On The Way to Branch", needsBranch: true },
  { value: "delivered_to_branch", label: "Delivered to Branch", needsBranch: true },
];
const DELIVERY_STATUS_OPTIONS = [
  { value: "on_the_way", label: "On The Way" },
  { value: "delivered", label: "Mark Delivered", needsSignature: true },
];

// Where the rider should be driving *right now* for this job — the
// customer for a pickup that hasn't happened yet and for every delivery,
// the destination branch once the device is in hand. Carries ready-made
// deep links so the app's Navigate button never has to work it out.
export type RiderNavigation = {
  target: "customer" | "branch";
  label: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string;
  wazeUrl: string;
};
function navigationFor(r: HomeServiceRequest, leg: "pickup" | "delivery", branch: { name: string; address: string; lat: number | null; lng: number | null } | null): RiderNavigation | null {
  const toBranch = leg === "pickup" && !!r.pickedUpAt && !r.receivedAtShopAt;
  if (toBranch && !branch) return null; // no destination branch chosen yet — the app shows its branch picker instead
  const name = toBranch ? `${branch!.name} branch` : r.customerName;
  const address = toBranch ? branch!.address : [r.street, r.barangay, r.city, r.province].filter(Boolean).join(", ");
  const lat = toBranch ? branch!.lat : r.lat;
  const lng = toBranch ? branch!.lng : r.lng;
  const dest = lat !== null && lng !== null ? `${lat},${lng}` : address;
  const encoded = encodeURIComponent(dest);
  return {
    target: toBranch ? "branch" : "customer",
    label: toBranch ? "Navigate to branch" : "Navigate to customer",
    name,
    address,
    lat,
    lng,
    // comgooglemaps:// goes straight to the route in the Google Maps app;
    // the app should fall back to this https form if the scheme can't open.
    googleMapsUrl: `https://maps.google.com/maps?daddr=${encoded}&dirflg=d`,
    wazeUrl: lat !== null && lng !== null ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${encoded}&navigate=yes`,
  };
}

type BookingRefs = { lookups: LookupItem[]; deviceModels: DeviceModel[]; customFormFields: CustomFormField[] };

function jobDTO(r: HomeServiceRequest, leg: "pickup" | "delivery", statusLabel: string | undefined, refs: BookingRefs) {
  const accepted = leg === "pickup" ? !!r.pickupRiderAcceptedAt : !!r.deliveryRiderAcceptedAt;
  const badge = !accepted
    ? "Awaiting your response"
    : leg === "pickup"
      ? r.headingToShopAt ? "Heading to branch" : r.pickedUpAt ? "Has device" : r.pickupStartedAt ? "On the way" : "Pickup"
      : r.outForDeliveryAt ? "On the way" : "Delivery";
  const defaultStatus =
    leg === "pickup"
      ? r.headingToShopAt ? "delivered_to_branch" : r.pickedUpAt ? "heading_to_shop" : r.pickupStartedAt ? "picked_up" : "on_the_way"
      : r.outForDeliveryAt ? "delivered" : "on_the_way";
  // Location sharing runs for the same windows RiderLocationReporter is
  // mounted on the web: pickup from On The Way until at the shop; delivery
  // once out for delivery until delivered.
  const sharingLocation =
    leg === "pickup" ? !!r.pickupStartedAt && !r.receivedAtShopAt : !!r.outForDeliveryAt && !r.deliveredAt;
  return {
    id: r.id,
    leg,
    reference: r.reference,
    customerName: r.customerName,
    phone: r.phone,
    email: r.email,
    street: r.street,
    barangay: r.barangay,
    city: r.city,
    province: r.province,
    landmark: r.landmark,
    lat: r.lat,
    lng: r.lng,
    deviceLabel: r.deviceOther || "Device not specified",
    issueDescription: r.issueDescription,
    // Everything the customer filled in on the booking form (device, service
    // needed, problem, extra fields) as label/value rows.
    bookingDetails: bookingDetailRows(r, refs.lookups, refs.deviceModels, refs.customFormFields),
    preferredDatetime: r.preferredDatetime,
    createdAt: r.createdAt,
    statusLabel: statusLabel ?? "",
    stage: pickupDeliveryStage(r, statusLabel),
    accepted,
    badge,
    defaultStatus,
    sharingLocation,
    pickupStartedAt: r.pickupStartedAt,
    pickedUpAt: r.pickedUpAt,
    headingToShopAt: r.headingToShopAt,
    receivedAtShopAt: r.receivedAtShopAt,
    outForDeliveryAt: r.outForDeliveryAt,
    deliveredAt: r.deliveredAt,
    deliveredBranchId: r.deliveredBranchId,
    pickupSecuritySeal: r.pickupSecuritySeal,
    // Total service (Booking, Diagnostic & Delivery Fee), what the customer
    // already paid by QR Ph, and the balance due on delivery.
    serviceFee: pickupDeliveryFeeSummary(r).fee,
    serviceFeePaid: pickupDeliveryFeeSummary(r).paid,
    serviceFeeBalance: pickupDeliveryFeeSummary(r).balance,
    // Package label — the same Pickup & Delivery job link JobQrCode encodes.
    qrUrl: `${SITE_URL}/admin/pickup-delivery/${r.id}`,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "rider" || !user.riderId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a rider." }, { status: 401 });
  }
  const riderId = user.riderId;

  const [allRequests, allBranches, rider, lookups, deviceModels, customFormFields] = await Promise.all([
    getRequests(),
    getBranches(),
    getRiderById(riderId),
    getLookups(),
    getDeviceModels(),
    getCustomFormFields(),
  ]);
  const refs: BookingRefs = { lookups, deviceModels, customFormFields };
  const statusLabel = (r: HomeServiceRequest) => lookups.find((l) => l.id === r.statusId)?.label;
  const byCreated = (a: HomeServiceRequest, b: HomeServiceRequest) => (a.createdAt < b.createdAt ? -1 : 1);
  // The "Bring the device to" branch — looked up across all branches (not
  // just active ones), the same as app/rider/page.tsx.
  const destination = (r: HomeServiceRequest) => {
    const b = r.deliveredBranchId ? allBranches.find((x) => x.id === r.deliveredBranchId) : null;
    return b ? { id: b.id, name: b.name, address: b.address, contactNumber: b.contactNumber, lat: b.lat, lng: b.lng } : null;
  };

  const pickups = allRequests
    .filter((r) => r.fulfillmentMode === "pickup_delivery" && r.pickupRiderId === riderId && !r.receivedAtShopAt)
    .sort(byCreated)
    .map((r) => {
      const branch = destination(r);
      return { ...jobDTO(r, "pickup", statusLabel(r), refs), destinationBranch: branch, navigation: navigationFor(r, "pickup", branch) };
    });
  const deliveries = allRequests
    .filter((r) => r.fulfillmentMode === "pickup_delivery" && r.deliveryRiderId === riderId && !r.deliveredAt)
    .sort(byCreated)
    .map((r) => ({ ...jobDTO(r, "delivery", statusLabel(r), refs), navigation: navigationFor(r, "delivery", null) }));

  return NextResponse.json(
    {
      ok: true,
      riderName: rider?.name ?? user.name,
      onDuty: rider?.onDuty ?? false,
      // address/contactNumber feed the "Bring the device to" box on a picked-up job.
      branches: allBranches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name, address: b.address, contactNumber: b.contactNumber, lat: b.lat, lng: b.lng })),
      pickups,
      deliveries,
      pickupStatusOptions: PICKUP_STATUS_OPTIONS,
      deliveryStatusOptions: DELIVERY_STATUS_OPTIONS,
      conditionItems: PICKUP_CONDITION_TEMPLATE.map((i) => ({ key: i.key, label: i.label, helpText: i.helpText })),
      conditionResultOptions: CONDITION_RESULT_OPTIONS,
      photoSlots: PHOTO_SLOTS,
      exceptionKinds: RIDER_EXCEPTION_KINDS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

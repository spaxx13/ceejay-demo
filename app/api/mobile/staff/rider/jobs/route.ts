import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { getBranches, getLookups, getRequests, getRiderById, pickupDeliveryStage } from "@/lib/db";
import { PICKUP_CONDITION_TEMPLATE, type HomeServiceRequest } from "@/lib/types";

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

function jobDTO(r: HomeServiceRequest, leg: "pickup" | "delivery", statusLabel: string | undefined) {
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

  const [allRequests, allBranches, rider, lookups] = await Promise.all([getRequests(), getBranches(), getRiderById(riderId), getLookups()]);
  const statusLabel = (r: HomeServiceRequest) => lookups.find((l) => l.id === r.statusId)?.label;
  const byCreated = (a: HomeServiceRequest, b: HomeServiceRequest) => (a.createdAt < b.createdAt ? -1 : 1);
  // The "Bring the device to" branch — looked up across all branches (not
  // just active ones), the same as app/rider/page.tsx.
  const destination = (r: HomeServiceRequest) => {
    const b = r.deliveredBranchId ? allBranches.find((x) => x.id === r.deliveredBranchId) : null;
    return b ? { id: b.id, name: b.name, address: b.address, contactNumber: b.contactNumber } : null;
  };

  const pickups = allRequests
    .filter((r) => r.fulfillmentMode === "pickup_delivery" && r.pickupRiderId === riderId && !r.receivedAtShopAt)
    .sort(byCreated)
    .map((r) => ({ ...jobDTO(r, "pickup", statusLabel(r)), destinationBranch: destination(r) }));
  const deliveries = allRequests
    .filter((r) => r.fulfillmentMode === "pickup_delivery" && r.deliveryRiderId === riderId && !r.deliveredAt)
    .sort(byCreated)
    .map((r) => jobDTO(r, "delivery", statusLabel(r)));

  return NextResponse.json(
    {
      ok: true,
      riderName: rider?.name ?? user.name,
      onDuty: rider?.onDuty ?? false,
      // address/contactNumber feed the "Bring the device to" box on a picked-up job.
      branches: allBranches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name, address: b.address, contactNumber: b.contactNumber })),
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

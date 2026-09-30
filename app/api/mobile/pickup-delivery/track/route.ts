import { NextRequest, NextResponse } from "next/server";
import {
  getRequestByReference,
  getRiders,
  getTechnicians,
  getBranches,
  getLookups,
  pickupDeliveryStage,
  PICKUP_DELIVERY_STAGE_LABELS,
  type PickupDeliveryStage,
} from "@/lib/db";

// Reference+phone tracker for Pickup & Delivery, mirroring
// app/(site)/track/page.tsx's derivation logic as JSON instead of HTML.
// Uses this page's own phone normalization (spaces/dashes stripped, +63 ->
// 0) rather than lib/sms.ts's version, which is tuned for outbound SMS and
// would mismatch some legitimately-matching numbers here.
function normalizePhone(p: string) {
  return p.replace(/[\s-]/g, "").replace(/^\+63/, "0");
}

const STAGE_ORDER: PickupDeliveryStage[] = [
  "requested",
  "pickup_assigned",
  "pickup_started",
  "picked_up",
  "heading_to_shop",
  "at_shop",
  "ready_for_delivery",
  "delivery_assigned",
  "out_for_delivery",
  "delivered",
];

export async function GET(req: NextRequest) {
  const reference = (req.nextUrl.searchParams.get("reference") ?? "").trim();
  const phone = (req.nextUrl.searchParams.get("phone") ?? "").trim();
  if (!reference || !phone) {
    return NextResponse.json({ error: "reference and phone are required." }, { status: 400 });
  }

  const [req_, riders, technicians, branches, lookups] = await Promise.all([
    getRequestByReference(reference),
    getRiders(),
    getTechnicians(),
    getBranches(),
    getLookups(),
  ]);
  const matches = req_ && normalizePhone(req_.phone) === normalizePhone(phone);
  if (!req_ || !matches) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const statusLabel = lookups.find((l) => l.id === req_.statusId)?.label;
  const stage = pickupDeliveryStage(req_, statusLabel);
  if (!stage) {
    return NextResponse.json({ error: "not_pickup_delivery", statusLabel: statusLabel ?? null }, { status: 409 });
  }

  const pickupRider = riders.find((r) => r.id === req_.pickupRiderId);
  const deliveryRider = riders.find((r) => r.id === req_.deliveryRiderId);
  const technician = technicians.find((t) => t.id === req_.assignedTechnicianId);
  const deliveredBranch = branches.find((b) => b.id === req_.deliveredBranchId);
  const isLiveStage = stage === "pickup_started" || stage === "picked_up" || stage === "heading_to_shop" || stage === "out_for_delivery";
  const customerAddress = [req_.street, req_.barangay, req_.city, req_.province].filter(Boolean).join(", ");
  const destinationAddress =
    stage === "pickup_started" || stage === "out_for_delivery" ? customerAddress : stage === "heading_to_shop" ? (deliveredBranch?.address ?? null) : null;
  const destinationLat =
    stage === "pickup_started" || stage === "out_for_delivery" ? req_.lat : stage === "heading_to_shop" ? (deliveredBranch?.lat ?? null) : null;
  const destinationLng =
    stage === "pickup_started" || stage === "out_for_delivery" ? req_.lng : stage === "heading_to_shop" ? (deliveredBranch?.lng ?? null) : null;
  const activeRider =
    stage === "out_for_delivery" || stage === "delivery_assigned"
      ? deliveryRider
      : stage === "pickup_assigned" || stage === "pickup_started" || stage === "picked_up" || stage === "heading_to_shop"
        ? pickupRider
        : null;

  return NextResponse.json(
    {
      reference: req_.reference,
      customerName: req_.customerName,
      stage,
      stageLabel: PICKUP_DELIVERY_STAGE_LABELS[stage],
      stageIndex: STAGE_ORDER.indexOf(stage),
      stageOrder: STAGE_ORDER,
      isLiveStage,
      activeRider: activeRider ? { name: activeRider.name } : null,
      technician: technician ? { name: technician.name } : null,
      deliveredBranch: deliveredBranch ? { name: deliveredBranch.name, address: deliveredBranch.address } : null,
      destinationAddress,
      destinationLat,
      destinationLng,
      riderLat: req_.riderLat,
      riderLng: req_.riderLng,
      riderLocationUpdatedAt: req_.riderLocationUpdatedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLookups, getRequests, getRequestPhotos, getDeviceModels, getServiceAgreements, getCustomFormFields, getServicePrices } from "@/lib/db";
import { serviceFeeAmount } from "@/lib/homeServiceFees";
import { getRepairQuote } from "@/lib/servicePricing";
import { isOnTheWayStatus } from "@/lib/technicianTracking";

// The technician's My Jobs board as JSON — a field-for-field mirror of
// app/technician/page.tsx's myRequests composition (same filters, same
// recomputed quote/fee, same flags), plus the request_status lookups the
// status picker needs, in one launch fetch.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician" || !user.technicianId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }

  const [lookups, allRequests, deviceModels, agreements, customFormFields, servicePrices] = await Promise.all([
    getLookups(),
    getRequests(),
    getDeviceModels(),
    getServiceAgreements(),
    getCustomFormFields(),
    getServicePrices(),
  ]);

  const statuses = lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);
  const cancelledStatusId = statuses.find((s) => s.label === "Cancelled")?.id;

  const mine = allRequests
    .filter((r) => r.assignedTechnicianId === user.technicianId && r.statusId !== cancelledStatusId)
    .sort((a, b) => (a.preferredDatetime < b.preferredDatetime ? -1 : 1));
  // getRequests() leaves the inline issue photo out (egress); fetch it for
  // just this technician's jobs.
  const photos = await getRequestPhotos(mine.map((r) => r.id));
  const jobs = mine.map((r) => {
      const brand = lookups.find((l) => l.id === r.deviceBrandId);
      const model = deviceModels.find((m) => m.id === r.deviceModelId);
      const serviceType = lookups.find((l) => l.id === r.serviceTypeId);
      const status = statuses.find((s) => s.id === r.statusId);
      const repairCost = serviceType?.label ? getRepairQuote(servicePrices, serviceType.label, r.deviceModelId ?? "", r.screenQuality) : null;
      const serviceFee = serviceFeeAmount(r.province, r.city);
      return {
        id: r.id,
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
        issueDescription: r.issueDescription,
        photoDataUrl: photos.get(r.id) ?? null,
        deviceLabel: brand ? `${brand.label} ${model?.name ?? ""}`.trim() : r.deviceOther || "—",
        serviceTypeLabel: serviceType?.label ?? "Service",
        preferredDatetime: r.preferredDatetime,
        vlogConsent: r.vlogConsent,
        vlogBlurPreference: r.vlogBlurPreference,
        createdAt: r.createdAt,
        statusId: r.statusId,
        statusLabel: status?.label ?? "",
        adminNotes: r.adminNotes,
        confirmedAt: r.confirmedAt,
        repairCost,
        serviceFee,
        downpaymentRequired: r.downpaymentRequired,
        downpaymentAmount: r.downpaymentAmount,
        downpaymentStatus: r.downpaymentStatus,
        inProgress: status?.label === "In Progress",
        onTheWay: isOnTheWayStatus(status?.label),
        hasPreAgreement: agreements.some((a) => a.requestId === r.id && a.phase === "pre_repair"),
        hasPostAgreement: agreements.some((a) => a.requestId === r.id && a.phase === "post_repair"),
        // Pickup & Delivery jobs at the shop get the Unboxing Video and
        // Repair Update buttons on the web board (TechnicianBoard.tsx).
        fulfillmentMode: r.fulfillmentMode,
        receivedAtShopAt: r.receivedAtShopAt,
        hasUnboxingVideo: !!r.unboxingVideoPath,
        unboxingVideoSent: !!r.unboxingVideoPublishedAt,
        customFieldEntries: Object.entries(r.customFields)
          .map(([key, value]) => ({ label: customFormFields.find((f) => f.key === key)?.label, value }))
          .filter((e): e is { label: string; value: string | boolean } => !!e.label),
      };
    });

  return NextResponse.json(
    {
      ok: true,
      jobs,
      statuses: statuses.map((s) => ({ id: s.id, label: s.label })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

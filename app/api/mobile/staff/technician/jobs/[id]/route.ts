import { NextRequest, NextResponse } from "next/server";
import { CHECKLIST_TEMPLATE, SERVICE_AGREEMENT_TERMS } from "@/lib/checklist";
import { MAX_PRICE_EDITS } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById, getLookups, getDeviceModels, getServiceAgreements } from "@/lib/db";
import type { ServiceAgreement } from "@/lib/types";

// Everything the checklist screens need for one job, mirroring
// app/technician/requests/[id]/checklist/page.tsx: the job header, the
// fixed checklist template + agreement terms (kept in code, not admin
// data), and the saved pre/post agreements. Agreements come back whole,
// signature/photo data URLs included — a single job's payload, not a list.
function agreementDTO(a: ServiceAgreement) {
  return {
    id: a.id,
    phase: a.phase,
    reference: a.reference,
    technicianName: a.technicianName,
    items: a.items,
    summaryNotes: a.summaryNotes,
    agreedToTerms: a.agreedToTerms,
    customerSignatureDataUrl: a.customerSignatureDataUrl,
    technicianSignatureDataUrl: a.technicianSignatureDataUrl,
    receiptPhotoDataUrl: a.receiptPhotoDataUrl,
    warrantyCoverage: a.warrantyCoverage,
    cost: a.cost,
    partsCost: a.partsCost,
    laborCost: a.laborCost,
    otherExpenses: a.otherExpenses,
    priceEditCount: a.priceEditCount,
    completedAt: a.completedAt,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "technician" || !user.technicianId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }

  const request = await getRequestById(id);
  if (!request || request.assignedTechnicianId !== user.technicianId) {
    return NextResponse.json({ ok: false, error: "This job isn't assigned to you." }, { status: 403 });
  }

  const [lookups, deviceModels, agreements] = await Promise.all([getLookups(), getDeviceModels(), getServiceAgreements()]);
  const brand = lookups.find((l) => l.id === request.deviceBrandId);
  const model = deviceModels.find((m) => m.id === request.deviceModelId);
  const deviceLabel = brand ? `${brand.label} ${model?.name ?? ""}`.trim() : request.deviceOther || "Device";
  const address =
    [request.street, request.city, request.province].filter(Boolean).join(", ") + (request.landmark ? ` (near ${request.landmark})` : "");

  const pre = agreements.find((a) => a.requestId === request.id && a.phase === "pre_repair");
  const post = agreements.find((a) => a.requestId === request.id && a.phase === "post_repair");

  return NextResponse.json(
    {
      ok: true,
      job: {
        id: request.id,
        reference: request.reference,
        customerName: request.customerName,
        phone: request.phone,
        email: request.email,
        deviceLabel,
        address,
      },
      checklistItems: CHECKLIST_TEMPLATE.map((t) => ({ key: t.key, label: t.label, helpText: t.helpText })),
      terms: SERVICE_AGREEMENT_TERMS,
      maxPriceEdits: MAX_PRICE_EDITS,
      preAgreement: pre ? agreementDTO(pre) : null,
      postAgreement: post ? agreementDTO(post) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

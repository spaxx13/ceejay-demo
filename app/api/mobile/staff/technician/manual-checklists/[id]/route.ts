import { NextRequest, NextResponse } from "next/server";
import { CHECKLIST_TEMPLATE, SERVICE_AGREEMENT_TERMS } from "@/lib/checklist";
import { submitManualChecklist } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { canViewManualRecord, getManualChecklists, getManualRecordStatus, getManualRepairRecordById } from "@/lib/db";
import type { ManualChecklist } from "@/lib/types";

// One manual ticket with both checklist phases, mirroring
// app/technician/manual-checklists/[id]/page.tsx — signatures and receipt
// photo included, since this is a single ticket's payload. The completed
// receipt PDF itself comes from the existing /api/manual-checklist-receipt/[id].
function checklistDTO(c: ManualChecklist) {
  return {
    id: c.id,
    phase: c.phase,
    items: c.items,
    summaryNotes: c.summaryNotes,
    agreedToTerms: c.agreedToTerms,
    warrantyCoverage: c.warrantyCoverage,
    receiptPhotoDataUrl: c.receiptPhotoDataUrl,
    customerSignatureDataUrl: c.customerSignatureDataUrl,
    staffSignatureDataUrl: c.staffSignatureDataUrl,
    completedAt: c.completedAt,
    sentToCustomerAt: c.sentToCustomerAt,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }
  const record = await getManualRepairRecordById(id);
  if (!record || record.deletedAt) return NextResponse.json({ ok: false, error: "Ticket not found." }, { status: 404 });
  if (!canViewManualRecord(user, record)) {
    return NextResponse.json({ ok: false, error: "You don't have access to this ticket." }, { status: 403 });
  }

  const all = await getManualChecklists();
  const checklists = all.filter((c) => c.manualRecordId === id);
  const pre = checklists.find((c) => c.phase === "pre_repair");
  const post = checklists.find((c) => c.phase === "post_repair");

  return NextResponse.json(
    {
      ok: true,
      record: {
        id: record.id, reference: record.reference, customerName: record.customerName, customerPhone: record.customerPhone,
        customerEmail: record.customerEmail, deviceLabel: record.deviceLabel, createdAt: record.createdAt,
        status: getManualRecordStatus(record, all),
      },
      pre: pre ? checklistDTO(pre) : null,
      post: post ? checklistDTO(post) : null,
      receiptPdfPath: post ? `/api/manual-checklist-receipt/${record.id}` : null,
      checklistItems: CHECKLIST_TEMPLATE.map((t) => ({ key: t.key, label: t.label, helpText: t.helpText })),
      terms: SERVICE_AGREEMENT_TERMS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// JSON→FormData wrap of submitManualChecklist (lib/actions.ts) unchanged —
// the Post-Repair half of a manual ticket (terms, warranty, signatures,
// optional receipt photo, receipt email). JSON keys: phase, result_<key>,
// notes_<key>, summaryNotes, customerSignature, staffSignature,
// agreedToTerms, warrantyCoverage, receiptPhotoDataUrl. manualRecordId
// comes from the URL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  const fd = new FormData();
  fd.set("manualRecordId", id);
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === "manualRecordId" || value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      if (value) fd.set(key, "on");
    } else {
      fd.set(key, String(value));
    }
  }
  const result = await submitManualChecklist(undefined, fd);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

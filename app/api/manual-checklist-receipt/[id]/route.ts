import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getManualRepairRecordById, getManualChecklistsForRecord, canViewManualRecord } from "@/lib/db";
import { generateRepairReceiptPdf } from "@/lib/receiptPdf";

// Regenerates the Manual Checklist & Receipt PDF on the fly, same "never
// persisted, rebuilt fresh every view" approach as /api/admin/receipt.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const record = await getManualRepairRecordById(id);
  if (!record || record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewManualRecord(user, record)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checklists = await getManualChecklistsForRecord(id);
  const pre = checklists.find((c) => c.phase === "pre_repair");
  const post = checklists.find((c) => c.phase === "post_repair");
  if (!post) return NextResponse.json({ error: "No completed checklist yet — there's no receipt." }, { status: 404 });

  const pdfBytes = await generateRepairReceiptPdf({
    reference: record.reference,
    customerName: record.customerName,
    serviceDate: post.completedAt?.slice(0, 10) ?? record.createdAt.slice(0, 10),
    deviceLabel: record.deviceLabel,
    natureOfRepair: record.issueDescription,
    warrantyCoverage: post.warrantyCoverage,
    postNotes: post.summaryNotes,
    repairCost: post.cost,
    serviceFee: post.laborCost, // parts/material cost and other expenses are internal-only, never included here
    technicianName: post.technicianName || record.createdByName,
    preItems: pre?.items ?? [],
    postItems: post.items,
    preCustomerSignature: pre?.customerSignatureDataUrl ?? null,
    preTechnicianSignature: pre?.staffSignatureDataUrl ?? null,
    postCustomerSignature: post.customerSignatureDataUrl,
    postTechnicianSignature: post.staffSignatureDataUrl,
    receiptPhoto: post.receiptPhotoDataUrl,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${record.reference}.pdf"`,
    },
  });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getManualRepairRecordById, getManualChecklists, canViewManualRecord } from "@/lib/db";
import { generateManualChecklistReceiptPdf } from "@/lib/receiptPdf";

// Regenerates the Manual Checklist & Receipt PDF on the fly, same "never
// persisted, rebuilt fresh every view" approach as /api/admin/receipt.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const record = await getManualRepairRecordById(id);
  if (!record || record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewManualRecord(user, record)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checklists = (await getManualChecklists()).filter((c) => c.manualRecordId === id);
  const pre = checklists.find((c) => c.phase === "pre_repair");
  const post = checklists.find((c) => c.phase === "post_repair");
  if (!post) return NextResponse.json({ error: "No completed checklist yet — there's no receipt." }, { status: 404 });

  const pdfBytes = await generateManualChecklistReceiptPdf({
    reference: record.reference,
    serviceDate: post.completedAt?.slice(0, 10) ?? record.createdAt.slice(0, 10),
    customerName: record.customerName,
    customerPhone: record.customerPhone,
    deviceLabel: record.deviceLabel,
    createdByName: record.createdByName,
    warrantyCoverage: post.warrantyCoverage,
    postNotes: post.summaryNotes,
    preItems: pre?.items ?? [],
    postItems: post.items,
    preCustomerSignature: pre?.customerSignatureDataUrl ?? null,
    preStaffSignature: pre?.staffSignatureDataUrl ?? null,
    postCustomerSignature: post.customerSignatureDataUrl,
    postStaffSignature: post.staffSignatureDataUrl,
    receiptPhoto: post.receiptPhotoDataUrl,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${record.reference}.pdf"`,
    },
  });
}

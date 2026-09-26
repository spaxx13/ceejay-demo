import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getManualChecklistById, canViewManualChecklist } from "@/lib/db";
import { generateManualChecklistReceiptPdf } from "@/lib/receiptPdf";

// Regenerates the Manual Checklist & Receipt PDF on the fly, same "never
// persisted, rebuilt fresh every view" approach as /api/admin/receipt.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const record = await getManualChecklistById(id);
  if (!record || record.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewManualChecklist(user, record)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pdfBytes = await generateManualChecklistReceiptPdf({
    reference: record.reference,
    serviceDate: record.createdAt.slice(0, 10),
    customerName: record.customerName,
    customerPhone: record.customerPhone,
    deviceLabel: record.deviceLabel,
    createdByName: record.createdByName,
    items: record.items,
    summaryNotes: record.summaryNotes,
    customerSignature: record.customerSignatureDataUrl,
    staffSignature: record.staffSignatureDataUrl,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${record.reference}.pdf"`,
    },
  });
}

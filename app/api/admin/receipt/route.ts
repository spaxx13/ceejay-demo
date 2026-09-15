import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById, getRepairRecordById, getServiceAgreements, getLookups } from "@/lib/db";
import { generateRepairReceiptPdf } from "@/lib/receiptPdf";

// Regenerates the exact same receipt PDF that resendReceiptEmail() emails
// out, but returns it inline for the admin/technician to view in the
// browser instead — the PDF is never persisted anywhere, so "view" and
// "resend" both rebuild it fresh from the same service_agreements rows
// every time. Mirrors resendReceiptEmail's auth and field mapping exactly
// (lib/actions.ts) so the two never drift apart.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner_admin" && user.role !== "branch_admin" && user.role !== "technician")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = req.nextUrl.searchParams.get("requestId");
  const repairRecordId = req.nextUrl.searchParams.get("repairRecordId");
  if (!requestId && !repairRecordId) {
    return NextResponse.json({ error: "Missing requestId or repairRecordId" }, { status: 400 });
  }
  if (user.role === "technician" && !requestId) {
    return NextResponse.json({ error: "Technicians can only view home service receipts" }, { status: 403 });
  }

  const agreements = await getServiceAgreements();
  let pdfBytes: Uint8Array;
  let filename: string;

  if (requestId) {
    const hsr = await getRequestById(requestId);
    if (!hsr) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (user.role === "technician" && hsr.assignedTechnicianId !== user.technicianId) {
      return NextResponse.json({ error: "This job isn't assigned to you" }, { status: 403 });
    }
    const pre = agreements.find((a) => a.requestId === requestId && a.phase === "pre_repair");
    const post = agreements.find((a) => a.requestId === requestId && a.phase === "post_repair");
    if (!post) return NextResponse.json({ error: "No completed checklist yet — there's no receipt." }, { status: 404 });
    const lookups = await getLookups();
    const serviceType = lookups.find((l) => l.id === hsr.serviceTypeId);

    pdfBytes = await generateRepairReceiptPdf({
      customerName: hsr.customerName,
      reference: hsr.reference,
      serviceDate: post.completedAt.slice(0, 10),
      deviceLabel: post.deviceLabel,
      natureOfRepair: [serviceType?.label, hsr.issueDescription].filter(Boolean).join(" — "),
      warrantyCoverage: post.warrantyCoverage,
      postNotes: post.summaryNotes,
      repairCost: post.cost,
      serviceFee: post.laborCost,
      technicianName: post.technicianName,
      preItems: pre?.items ?? [],
      postItems: post.items,
      preCustomerSignature: pre?.customerSignatureDataUrl ?? null,
      preTechnicianSignature: pre?.technicianSignatureDataUrl ?? null,
      postCustomerSignature: post.customerSignatureDataUrl,
      postTechnicianSignature: post.technicianSignatureDataUrl,
      receiptPhoto: post.receiptPhotoDataUrl,
      photoLabel: "Photo of Device",
    });
    filename = `receipt-${hsr.reference}.pdf`;
  } else {
    const record = await getRepairRecordById(repairRecordId!);
    if (!record) return NextResponse.json({ error: "Repair record not found" }, { status: 404 });
    const pre = agreements.find((a) => a.repairRecordId === repairRecordId && a.phase === "pre_repair");
    const post = agreements.find((a) => a.repairRecordId === repairRecordId && a.phase === "post_repair");
    if (!post) return NextResponse.json({ error: "No completed checklist yet — there's no receipt." }, { status: 404 });

    pdfBytes = await generateRepairReceiptPdf({
      customerName: record.customerName,
      reference: record.reference,
      serviceDate: record.serviceDate,
      deviceLabel: post.deviceLabel,
      natureOfRepair: [record.reportedProblem, record.servicePerformed].filter(Boolean).join(" — "),
      warrantyCoverage: post.warrantyCoverage,
      postNotes: post.summaryNotes,
      repairCost: record.cost,
      serviceFee: record.laborCost,
      technicianName: post.technicianName,
      preItems: pre?.items ?? [],
      postItems: post.items,
      preCustomerSignature: pre?.customerSignatureDataUrl ?? null,
      preTechnicianSignature: pre?.technicianSignatureDataUrl ?? null,
      postCustomerSignature: post.customerSignatureDataUrl,
      postTechnicianSignature: post.technicianSignatureDataUrl,
      receiptPhoto: post.receiptPhotoDataUrl,
    });
    filename = `receipt-${record.reference}.pdf`;
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

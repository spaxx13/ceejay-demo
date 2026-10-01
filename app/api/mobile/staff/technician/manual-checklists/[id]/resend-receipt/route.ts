import { NextRequest, NextResponse } from "next/server";
import { resendManualChecklistReceiptEmail } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";

// "Resend Receipt" on a completed manual ticket — wraps
// resendManualChecklistReceiptEmail unchanged (it checks access itself).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }
  const fd = new FormData();
  fd.set("manualRecordId", id);
  const result = await resendManualChecklistReceiptEmail(undefined, fd);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { resendReceiptEmail } from "@/lib/actions";

// Wraps resendReceiptEmail (lib/actions.ts) unchanged — resends the same
// saved PDF receipt to the customer. JSON key: requestId (technicians can
// only resend home-service receipts, enforced inside the action).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  if (!requestId) return NextResponse.json({ ok: false, error: "requestId is required." }, { status: 400 });

  const fd = new FormData();
  fd.set("requestId", requestId);
  const result = await resendReceiptEmail(undefined, fd);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

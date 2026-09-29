import { NextRequest, NextResponse } from "next/server";
import { updateAgreementPrice } from "@/lib/actions";

// Wraps updateAgreementPrice (lib/actions.ts) unchanged — same ownership
// check, 3-edit cap, and activity log. JSON keys: agreementId, cost,
// partsCost. (laborCost is ignored — the service fee is derived from the
// request, see requestServiceFee in lib/homeServiceFees.ts.)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const fd = new FormData();
  for (const key of ["agreementId", "cost", "partsCost"]) {
    const value = (body as Record<string, unknown>)[key];
    if (value !== null && value !== undefined) fd.set(key, String(value));
  }

  const result = await updateAgreementPrice(undefined, fd);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

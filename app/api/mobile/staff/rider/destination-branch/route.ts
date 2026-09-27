import { NextRequest, NextResponse } from "next/server";
import { riderUpdateDestinationBranch } from "@/lib/actions";
import { jsonToFormData, parseJsonBody } from "@/lib/mobileFormData";

// Mid-trip branch redirect — wraps riderUpdateDestinationBranch
// (lib/actions.ts) unchanged. JSON keys: requestId, deliveredBranchId.
export async function POST(req: NextRequest) {
  const body = parseJsonBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  const result = await riderUpdateDestinationBranch(undefined, jsonToFormData(body));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

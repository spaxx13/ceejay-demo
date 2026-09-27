import { NextRequest, NextResponse } from "next/server";
import { riderUpdateDeliveryStatus } from "@/lib/actions";
import { jsonToFormData, parseJsonBody } from "@/lib/mobileFormData";

// JSON→FormData wrap of riderUpdateDeliveryStatus (lib/actions.ts)
// unchanged. JSON keys: requestId, status (on_the_way | delivered),
// signatureDataUrl.
export async function POST(req: NextRequest) {
  const body = parseJsonBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  const result = await riderUpdateDeliveryStatus(undefined, jsonToFormData(body));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

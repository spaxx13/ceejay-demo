import { NextRequest, NextResponse } from "next/server";
import { riderUpdatePickupStatus } from "@/lib/actions";
import { jsonToFormData, parseJsonBody } from "@/lib/mobileFormData";

// JSON→FormData wrap of riderUpdatePickupStatus (lib/actions.ts) unchanged —
// same per-status checks, customer push/email, condition checklist and photo
// requirements. JSON keys mirror RiderStatusUpdateForm: requestId, status
// (on_the_way | picked_up | heading_to_shop | delivered_to_branch),
// deliveredBranchId, signatureDataUrl, securitySeal, existingDamageNotes,
// condition_<item> ("ok" | "damaged"), photo_<front|back|left|right|topBottom|damage>.
// Several base64 photos ride in one body — Vercel's ~4.5MB cap applies, so
// the app compresses each photo client-side first.
export async function POST(req: NextRequest) {
  const body = parseJsonBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  const result = await riderUpdatePickupStatus(undefined, jsonToFormData(body));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { submitWalkInRequest } from "@/lib/actions";
import { jsonToFormData, parseJsonBody } from "@/lib/mobileFormData";

// JSON→FormData wrap of submitWalkInRequest (lib/actions.ts) unchanged —
// same validation, email-OTP gate, walkin_requests insert, activity log and
// admin notification as the website form. JSON keys mirror
// components/site/WalkInForm.tsx: name, phone, email, branchId,
// deviceBrandId ("other" allowed), deviceModelId, deviceOther,
// serviceTypeId, issue, photoDataUrl, preferredDate (YYYY-MM-DD).
export async function POST(req: NextRequest) {
  const body = parseJsonBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  const result = await submitWalkInRequest(undefined, jsonToFormData(body));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

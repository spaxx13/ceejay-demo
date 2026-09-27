import { NextRequest, NextResponse } from "next/server";
import { reportRequestException } from "@/lib/actions";
import { jsonToFormData, parseJsonBody } from "@/lib/mobileFormData";

// "Report an Issue" — wraps reportRequestException (lib/actions.ts)
// unchanged (same request_exceptions insert, activity log, and the
// reschedule/cancel side effects). JSON keys: requestId, kind, reason,
// evidencePhotoDataUrl, newPreferredDatetime.
export async function POST(req: NextRequest) {
  const body = parseJsonBody(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  const result = await reportRequestException(undefined, jsonToFormData(body));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

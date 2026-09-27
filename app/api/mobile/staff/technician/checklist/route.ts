import { NextRequest, NextResponse } from "next/server";
import { submitChecklist } from "@/lib/actions";

// JSON→FormData wrap of submitChecklist (lib/actions.ts:3497), completely
// unchanged — same 11-item pass/fail/na validation, signature checks,
// post-repair terms/photo/price requirements, agreement insert, receipt
// email, and job auto-completion. Booleans are only set when true,
// matching the checkbox `.has()` convention. Expected JSON keys mirror
// the web form: requestId, phase, result_<key>, notes_<key>,
// customerSignature, technicianSignature, summaryNotes, agreedToTerms,
// receiptPhotoDataUrl, warrantyCoverage, cost, partsCost, laborCost,
// otherExpenses. Body carries several base64 images — Vercel's ~4.5MB
// request cap applies, so the app compresses photos client-side first.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const fd = new FormData();
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      if (value) fd.set(key, "on");
    } else {
      fd.set(key, String(value));
    }
  }

  const result = await submitChecklist(undefined, fd);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

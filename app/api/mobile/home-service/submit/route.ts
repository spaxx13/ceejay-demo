import { NextRequest, NextResponse } from "next/server";
import { submitHomeServiceRequest } from "@/lib/actions";

// Builds a FormData object matching what the web form's `new
// FormData(formElement)` produces, so submitHomeServiceRequest runs
// completely unchanged — same ~10-step validation cascade, same DB writes,
// same SMS/email/notification side effects as a web booking. Booleans
// (vlogConsent, custom_<key> checkboxes) are only set when true, matching
// the `formData.has(key)` checkbox convention the action checks against —
// omitting the key entirely for false is the correct translation, not
// setting it to the string "false".
function buildFormData(body: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      if (value) fd.set(key, "on");
    } else {
      fd.set(key, String(value));
    }
  }
  return fd;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const formData = buildFormData(body as Record<string, unknown>);
  const result = await submitHomeServiceRequest(undefined, formData);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

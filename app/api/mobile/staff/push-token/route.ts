import { NextRequest, NextResponse } from "next/server";
import { registerStaffPushToken } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";

// FCM token registration for the native staff apps — wraps
// registerStaffPushToken (lib/actions.ts:4173), same staff_push_tokens
// upsert the Capacitor apps use, so notifyTechnician/notifyRider deliver
// to native installs with zero send-side changes.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "technician" && user.role !== "rider")) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ ok: false, error: "token is required." }, { status: 400 });

  await registerStaffPushToken(token);
  return NextResponse.json({ ok: true });
}

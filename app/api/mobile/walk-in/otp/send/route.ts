import { NextRequest, NextResponse } from "next/server";
import { sendWalkInOtp } from "@/lib/actions";

// Walk-in pre-registration's email OTP — wraps sendWalkInOtp unchanged
// (same cooldown, TTL and email). JSON: { email }.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  if (!email) return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });

  const result = await sendWalkInOtp(email);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

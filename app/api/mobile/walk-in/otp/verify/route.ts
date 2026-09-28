import { NextRequest, NextResponse } from "next/server";
import { verifyWalkInOtp } from "@/lib/actions";

// Wraps verifyWalkInOtp unchanged (attempt cap, expiry). JSON: { email, code }.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const code = typeof body?.code === "string" ? body.code : "";
  if (!email || !code) return NextResponse.json({ ok: false, error: "Email and code are required." }, { status: 400 });

  const result = await verifyWalkInOtp(email, code);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

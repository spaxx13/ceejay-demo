import { NextRequest, NextResponse } from "next/server";
import { verifyHomeServiceOtp } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const code = typeof body?.code === "string" ? body.code : "";
  if (!phone || !code) return NextResponse.json({ ok: false, error: "Phone and code are required." }, { status: 400 });

  const result = await verifyHomeServiceOtp(phone, code);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

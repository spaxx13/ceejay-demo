import { NextRequest, NextResponse } from "next/server";
import { sendHomeServiceOtp } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  if (!phone) return NextResponse.json({ ok: false, error: "Phone number is required." }, { status: 400 });

  const result = await sendHomeServiceOtp(phone);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

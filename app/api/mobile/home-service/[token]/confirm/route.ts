import { NextRequest, NextResponse } from "next/server";
import { confirmBooking } from "@/lib/actions";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await confirmBooking(token);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

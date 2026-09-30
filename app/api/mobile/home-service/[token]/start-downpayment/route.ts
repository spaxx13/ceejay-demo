import { NextRequest, NextResponse } from "next/server";
import { startHomeServiceDownpayment } from "@/lib/actions";

// On failure, startHomeServiceDownpayment resolves normally with
// {ok:false, error} (returned below as 400 JSON). On success it calls
// Next's redirect(checkoutUrl) as its last statement — nothing runs after
// that, and Next.js's own Route Handler machinery turns the thrown
// NEXT_REDIRECT into a real HTTP 307 with a Location header. Callers
// should follow the redirect (or read the Location header) rather than
// expect a 200 JSON body on the success path.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await startHomeServiceDownpayment(token);
  return NextResponse.json(result, { status: 400 });
}

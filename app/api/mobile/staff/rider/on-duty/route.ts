import { NextRequest, NextResponse } from "next/server";
import { setRiderOnDuty } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getRiderById } from "@/lib/db";

// The rider's own on-duty switch — wraps setRiderOnDuty (lib/actions.ts)
// unchanged and returns the stored value afterward. JSON: { onDuty: boolean }.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "rider" || !user.riderId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a rider." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (typeof body?.onDuty !== "boolean") {
    return NextResponse.json({ ok: false, error: "onDuty (boolean) is required." }, { status: 400 });
  }
  const fd = new FormData();
  fd.set("onDuty", String(body.onDuty));
  await setRiderOnDuty(fd);
  const rider = await getRiderById(user.riderId);
  return NextResponse.json({ ok: true, onDuty: rider?.onDuty ?? body.onDuty });
}

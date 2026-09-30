import { NextRequest, NextResponse } from "next/server";
import { riderAcceptDelivery, riderAcceptPickup, riderDeclineDelivery, riderDeclinePickup } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById } from "@/lib/db";

// Accept / Decline a pickup or delivery leg — wraps the four rider
// accept/decline actions (lib/actions.ts) unchanged. Those return void and
// silently no-op on any refusal, so the same checks run here first purely
// to give the app a real error instead of a silent nothing. JSON:
// { requestId, leg: "pickup" | "delivery", action: "accept" | "decline" }.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "rider" || !user.riderId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a rider." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const leg = body?.leg === "pickup" || body?.leg === "delivery" ? body.leg : "";
  const action = body?.action === "accept" || body?.action === "decline" ? body.action : "";
  if (!requestId || !leg || !action) {
    return NextResponse.json({ ok: false, error: "requestId, leg and action are required." }, { status: 400 });
  }

  const r = await getRequestById(requestId);
  if (!r) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
  if (leg === "pickup") {
    if (r.pickupRiderId !== user.riderId) return NextResponse.json({ ok: false, error: "This job isn't assigned to you." }, { status: 403 });
    if (action === "accept" && r.pickupRiderAcceptedAt) return NextResponse.json({ ok: true });
    if (action === "decline" && r.pickupStartedAt) {
      return NextResponse.json({ ok: false, error: "This trip has already started — it can't be declined." }, { status: 400 });
    }
  } else {
    if (r.deliveryRiderId !== user.riderId) return NextResponse.json({ ok: false, error: "This job isn't assigned to you." }, { status: 403 });
    if (action === "accept" && r.deliveryRiderAcceptedAt) return NextResponse.json({ ok: true });
    if (action === "decline" && r.outForDeliveryAt) {
      return NextResponse.json({ ok: false, error: "This trip has already started — it can't be declined." }, { status: 400 });
    }
  }

  const fd = new FormData();
  fd.set("requestId", requestId);
  if (leg === "pickup") {
    await (action === "accept" ? riderAcceptPickup(fd) : riderDeclinePickup(fd));
  } else {
    await (action === "accept" ? riderAcceptDelivery(fd) : riderDeclineDelivery(fd));
  }
  return NextResponse.json({ ok: true });
}

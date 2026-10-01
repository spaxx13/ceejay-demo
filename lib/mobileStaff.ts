import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById } from "@/lib/db";

// Shared gate for the native Technician app's per-job routes: signed in as
// a technician, and this Pickup & Delivery job is assigned to them. The
// wrapped server actions only check the role, so the mobile layer adds the
// assignment check the web pages get from only linking a technician's own
// jobs. Returns either the user + request or a ready-to-send error.
export async function requireAssignedPickupDeliveryJob(requestId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician" || !user.technicianId) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 }) } as const;
  }
  const request = await getRequestById(requestId);
  if (!request || request.assignedTechnicianId !== user.technicianId) {
    return { error: NextResponse.json({ ok: false, error: "This job isn't assigned to you." }, { status: 403 }) } as const;
  }
  if (request.fulfillmentMode !== "pickup_delivery") {
    return { error: NextResponse.json({ ok: false, error: "This is only for Pickup & Delivery jobs." }, { status: 400 }) } as const;
  }
  return { user, request } as const;
}

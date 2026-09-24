import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageHomeServiceRequests, getRequestById, isBranchHidden } from "@/lib/db";
import { getTrackingSnapshotForRequest } from "@/lib/trackingSnapshot";

// Polled by the live map on the admin request page. Same access rule as
// that page: Home Service managers only, and not for a queue hidden from them.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { requestId } = await params;
  const req = await getRequestById(requestId);
  if (!req || isBranchHidden(user, req.queueBranchId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const snapshot = await getTrackingSnapshotForRequest(requestId);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}

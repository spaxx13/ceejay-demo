import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById, updateRiderLiveLocation } from "@/lib/db";

// Pinged every ~10-15s by components/RiderLocationReporter.tsx (the rider's
// own browser, via the Geolocation API) while a job's pickup leg is "On The
// Way" or "On The Way to Branch" — a plain fetch, not a server action, so a
// dropped/slow ping never triggers a full page navigation or revalidation.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "rider" || !user.riderId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const lat = typeof body?.lat === "number" ? body.lat : null;
  const lng = typeof body?.lng === "number" ? body.lng : null;
  if (!requestId || lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Missing or invalid requestId/lat/lng" }, { status: 400 });
  }
  // Only Metro Manila-scale coordinates are ever meaningful here — a wildly
  // out-of-range value means a bad GPS fix, not a real location worth saving.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
  }

  const hsr = await getRequestById(requestId);
  if (!hsr || hsr.pickupRiderId !== user.riderId) {
    return NextResponse.json({ error: "This job isn't assigned to you" }, { status: 403 });
  }

  await updateRiderLiveLocation(requestId, lat, lng);
  return NextResponse.json({ ok: true });
}

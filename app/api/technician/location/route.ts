import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRequestById, getLookups, query } from "@/lib/db";
import { isOnTheWayStatus } from "@/lib/technicianTracking";

// Pinged by components/TechnicianLocationSharer.tsx (via CapacitorHttp, so
// it keeps working from the native app's background geolocation callback —
// see that component's doc comment for why this can't be a plain fetch or
// a server action) while a job is On The Way. A plain REST route, not a
// server action, so a dropped/slow ping never triggers a page navigation.
//
// `stop: true` in the response tells the caller to stop watching/reporting
// permanently — either because the job left On The Way (normal end of a
// trip) or because it isn't this technician's job to report on in the
// first place. A 401 here does NOT set `stop: true`, even though it looks
// similarly terminal: an expired/missing session cookie on one ping is
// often transient (e.g. CapacitorHttp momentarily not having synced the
// WebView's cookie jar yet on a cold app start) and can recover on the
// next GPS fix — treating it as a hard stop would silently and
// permanently end location sharing for the rest of the trip.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician" || !user.technicianId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const lat = typeof body?.lat === "number" ? body.lat : null;
  const lng = typeof body?.lng === "number" ? body.lng : null;
  if (!requestId || lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid requestId/lat/lng" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ ok: false, error: "Coordinates out of range" }, { status: 400 });
  }

  const hsr = await getRequestById(requestId);
  if (!hsr || hsr.assignedTechnicianId !== user.technicianId) {
    return NextResponse.json({ ok: false, stop: true, error: "This job isn't assigned to you" }, { status: 403 });
  }
  const status = (await getLookups()).find((l) => l.id === hsr.statusId);
  if (!isOnTheWayStatus(status?.label)) {
    return NextResponse.json({ ok: false, stop: true, error: "This job is no longer On The Way" });
  }

  await query("update home_service_requests set tech_lat=$1, tech_lng=$2, tech_location_at=now() where id=$3", [lat, lng, requestId]);
  return NextResponse.json({ ok: true });
}

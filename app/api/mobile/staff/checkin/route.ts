import { NextRequest, NextResponse } from "next/server";
import { checkIn } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getBranches, getTechnicians, getTodayCheckIn } from "@/lib/db";
import { isCheckInOpen } from "@/lib/format";

// The technician check-in widget's data + action as one endpoint. GET
// mirrors what app/technician/page.tsx feeds CheckInWidget (the
// technician's own active branches, today's check-in if any, and whether
// check-in is open yet — branches open 6:00 AM). POST wraps checkIn
// (lib/actions.ts), surfacing its error (if any) in the JSON response
// instead of a silent no-op — a native client (not this web app) must
// also send a photoDataUrl captured with the device's own camera.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician" || !user.technicianId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }

  const [branches, technicians, todayCheckIn] = await Promise.all([getBranches(), getTechnicians(), getTodayCheckIn(user.id)]);
  const myBranchIds = technicians.find((t) => t.id === user.technicianId)?.branchIds ?? [];

  return NextResponse.json(
    {
      ok: true,
      open: isCheckInOpen(),
      branches: branches.filter((b) => b.active && myBranchIds.includes(b.id)).map((b) => ({ id: b.id, name: b.name })),
      todayCheckIn: todayCheckIn ? { branchName: todayCheckIn.branchName, at: todayCheckIn.checkedInAt } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const branchId = typeof body?.branchId === "string" ? body.branchId : "";
  if (!branchId) return NextResponse.json({ ok: false, error: "branchId is required." }, { status: 400 });
  // A live-camera selfie, same requirement as the web Check-In widget (see
  // SelfieCapture) — the app must capture it with the device's own camera,
  // never let the technician attach an existing photo.
  const photoDataUrl = typeof body?.photoDataUrl === "string" ? body.photoDataUrl : "";
  if (!photoDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ ok: false, error: "photoDataUrl (a captured selfie) is required." }, { status: 400 });
  }

  const fd = new FormData();
  fd.set("branchId", branchId);
  fd.set("photoDataUrl", photoDataUrl);
  const result = await checkIn(undefined, fd);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { technicianUpdateStatus } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getLookups, getRequestById } from "@/lib/db";

// Wraps technicianUpdateStatus (lib/actions.ts:3398) unchanged — all its
// side effects (status_history, notes, Cancelled soft-delete + customer
// email, admin notifications, and the first-On-the-way tracking token +
// customer link) run exactly as on the web. The action itself silently
// no-ops on any refusal, so the same checks run here first purely to give
// the app a real error message instead of a silent nothing.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician" || !user.technicianId) {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const statusId = typeof body?.statusId === "string" ? body.statusId : "";
  const note = typeof body?.note === "string" ? body.note : "";
  if (!id || !statusId) {
    return NextResponse.json({ ok: false, error: "id and statusId are required." }, { status: 400 });
  }

  const [request, lookups] = await Promise.all([getRequestById(id), getLookups()]);
  if (!request || request.assignedTechnicianId !== user.technicianId) {
    return NextResponse.json({ ok: false, error: "This job isn't assigned to you." }, { status: 403 });
  }
  const status = lookups.find((l) => l.id === statusId && l.kind === "request_status");
  if (!status) {
    return NextResponse.json({ ok: false, error: "Unknown status." }, { status: 400 });
  }
  // Same restriction technicianUpdateStatus enforces silently: "Pending
  // Confirmation" is a booking-side state and "Completed" only comes from
  // submitting the Post-Repair checklist.
  if (statusId !== request.statusId && (status.label === "Pending Confirmation" || status.label === "Completed")) {
    return NextResponse.json(
      { ok: false, error: status.label === "Completed" ? "Submit the Post-Repair Checklist to complete this job." : "Technicians can't set this status." },
      { status: 400 },
    );
  }

  const fd = new FormData();
  fd.set("id", id);
  fd.set("statusId", statusId);
  if (note) fd.set("note", note);
  await technicianUpdateStatus(fd);

  return NextResponse.json({ ok: true });
}

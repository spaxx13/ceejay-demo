import { NextRequest, NextResponse } from "next/server";
import { CHECKLIST_TEMPLATE, SERVICE_AGREEMENT_TERMS } from "@/lib/checklist";
import { createManualRepairRecord } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import {
  canManageManualChecklists, getBranches, getManualChecklists, getManualRecordStatus, getManualRepairRecords, getTechnicians,
} from "@/lib/db";

// Manual Checklist & Receipt for the technician app — mirrors
// app/technician/manual-checklists/page.tsx (own tickets only) and
// new/page.tsx (branch choices scoped to the technician's branches).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "technician") {
    return NextResponse.json({ ok: false, error: "Not signed in as a technician." }, { status: 401 });
  }
  if (!canManageManualChecklists(user)) {
    return NextResponse.json({ ok: false, error: "You don't have access to Manual Checklist & Receipt." }, { status: 403 });
  }

  const [allRecords, checklists, allBranches, technicians] = await Promise.all([
    getManualRepairRecords(), getManualChecklists(), getBranches(), getTechnicians(),
  ]);
  const own = technicians.find((t) => t.id === user.technicianId);
  const branches = allBranches
    .filter((b) => b.active && (own?.branchIds.includes(b.id) ?? true))
    .map((b) => ({ id: b.id, name: b.name }));
  const records = allRecords
    .filter((r) => r.createdByUserId === user.id)
    .map((r) => ({
      id: r.id, reference: r.reference, customerName: r.customerName, customerPhone: r.customerPhone,
      customerEmail: r.customerEmail, deviceLabel: r.deviceLabel, createdAt: r.createdAt,
      status: getManualRecordStatus(r, checklists),
    }));

  return NextResponse.json(
    {
      ok: true,
      records,
      branches,
      checklistItems: CHECKLIST_TEMPLATE.map((t) => ({ key: t.key, label: t.label, helpText: t.helpText })),
      terms: SERVICE_AGREEMENT_TERMS,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// JSON→FormData wrap of createManualRepairRecord (lib/actions.ts) — creates
// the ticket and its Pre-Repair checklist together, exactly as the web form.
// JSON keys: customerName, customerPhone, customerEmail, deviceLabel,
// branchId, summaryNotes, result_<key>, notes_<key>, customerSignature,
// staffSignature.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  const fd = new FormData();
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      if (value) fd.set(key, "on");
    } else {
      fd.set(key, String(value));
    }
  }
  const result = await createManualRepairRecord(undefined, fd);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

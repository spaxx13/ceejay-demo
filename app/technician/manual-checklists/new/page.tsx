import Link from "next/link";
import { redirect } from "next/navigation";
import { getBranches, getTechnicians, canManageManualChecklists } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import ManualChecklistForm from "@/components/ManualChecklistForm";

export default async function NewTechnicianManualChecklistPage() {
  const user = await getCurrentUser();
  if (!canManageManualChecklists(user)) redirect("/technician");

  const [allBranches, technicians] = await Promise.all([getBranches(), getTechnicians()]);
  const own = technicians.find((t) => t.id === user!.technicianId);
  const branches = allBranches.filter((b) => b.active && (own?.branchIds.includes(b.id) ?? true)).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/technician/manual-checklists" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back
        </Link>
        <h1 className="mt-1 text-lg font-bold text-slate-900">New Manual Checklist</h1>
      </div>
      <ManualChecklistForm branches={branches} receiptHrefBase="/api/manual-checklist-receipt" backHref="/technician/manual-checklists" />
    </div>
  );
}

import Link from "next/link";
import { getBranches, getTechnicians, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import NewRepairRecordForm from "@/components/NewRepairRecordForm";

export default async function NewRepairRecordPage() {
  const [user, allBranches, allTechnicians] = await Promise.all([getCurrentUser(), getBranches(), getTechnicians()]);
  const branches = allBranches.filter((b) => b.active && !isBranchHidden(user, b.id));
  const technicians = allTechnicians.filter((t) => t.active).map((t) => ({ name: t.name, branchIds: t.branchIds }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/pos" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to records
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">New Repair Record</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fill in the repair details and the Pre-Repair checklist, then save. The ticket is saved as pending — finish the Post-Repair
          checklist now, or come back to it later to close it out and email the customer&apos;s receipt.
        </p>
      </div>
      <NewRepairRecordForm branches={branches.map((b) => ({ id: b.id, name: b.name }))} technicians={technicians} />
    </div>
  );
}

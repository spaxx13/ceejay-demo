import Link from "next/link";
import { getBranches, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import ManualChecklistForm from "@/components/ManualChecklistForm";

export default async function NewManualChecklistPage() {
  const [user, allBranches] = await Promise.all([getCurrentUser(), getBranches()]);
  const branches = allBranches.filter((b) => b.active && !isBranchHidden(user, b.id)).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/manual-checklists" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to Manual Checklists
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">New Manual Checklist</h1>
        <p className="mt-1 text-sm text-slate-400">Fill in the customer/device details and checklist, then save to generate a receipt.</p>
      </div>
      <ManualChecklistForm branches={branches} detailHrefBase="/admin/manual-checklists" backHref="/admin/manual-checklists" />
    </div>
  );
}

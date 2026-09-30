import Link from "next/link";
import { redirect } from "next/navigation";
import { getManualRepairRecords, getManualChecklists, getManualRecordStatus, canManageManualChecklists } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

const STATUS_CLASS: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-green-200 bg-green-50 text-green-700",
};
const STATUS_LABEL: Record<string, string> = { pending: "Pending Post-Repair", completed: "Completed" };

export default async function TechnicianManualChecklistsPage() {
  const user = await getCurrentUser();
  if (!canManageManualChecklists(user)) redirect("/technician");

  const [allRecords, checklists] = await Promise.all([getManualRepairRecords(), getManualChecklists()]);
  const records = allRecords.filter((r) => r.createdByUserId === user!.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Manual Checklist & Receipt</h1>
          <p className="mt-1 text-sm text-slate-400">A Pre/Post-Repair checklist and emailed receipt for a walk-in customer.</p>
        </div>
        <Link href="/technician/manual-checklists/new" className="btn-primary">
          New Ticket
        </Link>
      </div>

      <div className="space-y-2">
        {records.length === 0 && <p className="card text-center text-sm text-slate-400">No manual checklists yet.</p>}
        {records.map((r) => {
          const status = getManualRecordStatus(r, checklists);
          return (
            <Link key={r.id} href={`/technician/manual-checklists/${r.id}`} className="card block space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-blue-300">{r.reference}</p>
                <p className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</p>
              </div>
              <p className="text-sm text-slate-700">{r.customerName}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">{r.deviceLabel}</p>
                <span className={`badge border ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

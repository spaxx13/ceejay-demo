import Link from "next/link";
import { getManualChecklists, getBranches, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function ManualChecklistsPage() {
  const [user, allRecords, allBranches] = await Promise.all([getCurrentUser(), getManualChecklists(), getBranches()]);
  const records = allRecords.filter((r) => !isBranchHidden(user, r.branchId));
  const branchName = (id: string | null) => (id ? allBranches.find((b) => b.id === id)?.name ?? "—" : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manual Checklist & Receipt</h1>
          <p className="mt-1 text-sm text-slate-400">
            A quick device-condition checklist and receipt for a customer with no online booking or POS sale — e.g. a walk-in drop-off.
          </p>
        </div>
        <Link href="/admin/manual-checklists/new" className="btn-primary">
          New Checklist
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Device</th>
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2 pr-3">Attended By</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No manual checklists yet.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3">
                  <Link href={`/admin/manual-checklists/${r.id}`} className="font-medium text-blue-300 hover:underline">
                    {r.reference}
                  </Link>
                </td>
                <td className="py-3 pr-3 text-slate-700">{r.customerName}</td>
                <td className="py-3 pr-3 text-slate-500">{r.deviceLabel}</td>
                <td className="py-3 pr-3 text-slate-500">{branchName(r.branchId)}</td>
                <td className="py-3 pr-3 text-slate-500">{r.createdByName || "—"}</td>
                <td className="py-3 text-slate-500">{formatDateTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

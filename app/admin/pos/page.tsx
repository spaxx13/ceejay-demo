import Link from "next/link";
import { getRepairRecords, getServiceAgreements, getRepairRecordStatus, getBranches, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import PopupLink from "@/components/PopupLink";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PosPage({ searchParams }: { searchParams: Promise<{ q?: string; date?: string; status?: string; branch?: string }> }) {
  const sp = await searchParams;
  const [user, allRecordsRaw, agreements, allBranchesRaw] = await Promise.all([getCurrentUser(), getRepairRecords(), getServiceAgreements(), getBranches()]);
  const allBranches = allBranchesRaw.filter((b) => !isBranchHidden(user, b.id));
  const allRecords = allRecordsRaw.filter((r) => !isBranchHidden(user, r.branchId));
  const statusOf = (r: (typeof allRecords)[number]) => getRepairRecordStatus(r, agreements);
  const branches = allBranches.filter((b) => b.active);
  const branchName = (branchId: string | null) => allBranches.find((b) => b.id === branchId)?.name ?? "—";

  let records = [...allRecords];
  if (sp.date) records = records.filter((r) => r.serviceDate === sp.date);
  if (sp.status === "cancelled") records = records.filter((r) => statusOf(r) === "cancelled");
  if (sp.status === "completed") records = records.filter((r) => statusOf(r) === "completed");
  if (sp.status === "pending") records = records.filter((r) => statusOf(r) === "pending");
  if (sp.branch) records = records.filter((r) => r.branchId === sp.branch);
  if (sp.q) {
    const q = sp.q.toLowerCase();
    records = records.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.contactNumber.includes(q) ||
        r.technicianName.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.deviceModel.toLowerCase().includes(q)
    );
  }
  records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = allRecords.filter((r) => r.serviceDate === today);
  const todayTotal = todayRecords.filter((r) => statusOf(r) !== "cancelled").reduce((sum, r) => sum + r.cost, 0);
  const pendingCount = allRecords.filter((r) => statusOf(r) === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Repair Records</h1>
          <p className="mt-1 text-sm text-slate-400">A simple log of customers, their devices, reported problems, and repairs performed.</p>
        </div>
        <PopupLink href="/admin/pos/new" className="btn-primary">
          + New Record
        </PopupLink>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs text-slate-400">Today&apos;s Records</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{todayRecords.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Today&apos;s Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{peso(todayTotal)}</p>
        </div>
        <Link href="/admin/pos?status=pending" className="card block hover:border-blue-300">
          <p className="text-xs text-slate-400">Pending Tickets</p>
          <p className={`mt-1 text-2xl font-bold ${pendingCount > 0 ? "text-amber-700" : "text-slate-900"}`}>{pendingCount}</p>
        </Link>
        <div className="card">
          <p className="text-xs text-slate-400">All-Time Records</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{allRecords.length}</p>
        </div>
      </div>

      <form className="card flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search customer, phone, technician, device, or reference..." className="input w-72" />
        <input type="date" name="date" defaultValue={sp.date ?? ""} className="input w-44" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-40">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select name="branch" defaultValue={sp.branch ?? ""} className="input w-40">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        <Link href="/admin/pos" className="btn-secondary">
          Clear
        </Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Device</th>
              <th className="pb-2 pr-3">Technician</th>
              <th className="pb-2 pr-3">Cost</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-400">
                  No repair records yet.
                </td>
              </tr>
            )}
            {records.map((r) => {
              const status = statusOf(r);
              return (
                <tr key={r.id} className={`border-b border-slate-200 last:border-0 ${status === "cancelled" ? "opacity-60" : ""}`}>
                  <td className="py-3 pr-3 font-mono text-xs text-blue-300">{r.reference}</td>
                  <td className="py-3 pr-3 text-slate-500">{branchName(r.branchId)}</td>
                  <td className="py-3 pr-3 text-slate-800">{r.customerName}</td>
                  <td className="py-3 pr-3 text-slate-500">{r.deviceModel || "—"}</td>
                  <td className="py-3 pr-3 text-slate-500">{r.technicianName || "—"}</td>
                  <td className="py-3 pr-3 font-semibold text-slate-800">{peso(r.cost)}</td>
                  <td className="py-3 pr-3">
                    {status === "cancelled" && <span className="badge border border-red-200 bg-red-50 text-red-700">Cancelled</span>}
                    {status === "completed" && <span className="badge border border-green-200 bg-green-50 text-green-700">Completed</span>}
                    {status === "pending" && <span className="badge border border-amber-200 bg-amber-50 text-amber-700">Pending</span>}
                  </td>
                  <td className="py-3 pr-3 text-slate-500">{formatDateTime(r.createdAt)}</td>
                  <td className="py-3">
                    <div className="flex gap-1.5">
                      {status === "pending" ? (
                        <PopupLink href={`/admin/pos/${r.id}`} className="btn-primary !px-3 !py-1 text-xs">
                          Resume
                        </PopupLink>
                      ) : (
                        <Link href={`/admin/pos/${r.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                          View
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

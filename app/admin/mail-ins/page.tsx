import Link from "next/link";
import { redirect } from "next/navigation";
import { getLookups, getBranches, getDeviceModels, getMailInRequests, canManageWalkIns, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import BarBreakdownChart from "@/components/BarBreakdownChart";
import { formatDate } from "@/lib/format";

export default async function MailInsPage({ searchParams }: { searchParams: Promise<{ status?: string; branch?: string }> }) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user)) redirect("/admin");

  const sp = await searchParams;
  const [lookups, branches, deviceModels, allRequests] = await Promise.all([getLookups(), getBranches(), getDeviceModels(), getMailInRequests()]);
  const statuses = lookups.filter((l) => l.kind === "mailin_status").sort((a, b) => a.order - b.order);

  // Branch scoping — a branch admin only sees mail-ins addressed to their branch(es).
  const visible = allRequests.filter((r) => !isBranchHidden(user, r.branchId));
  let requests = [...visible];
  if (sp.status) requests = requests.filter((r) => r.statusId === sp.status);
  if (sp.branch) requests = requests.filter((r) => r.branchId === sp.branch);
  requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const byStatus = statuses.map((s) => ({ label: s.label, value: visible.filter((r) => r.statusId === s.id).length }));

  function labelFor(id: string | null, list: { id: string; label?: string; name?: string }[]) {
    if (!id) return "—";
    const found = list.find((x) => x.id === id);
    return found?.label ?? found?.name ?? "—";
  }
  function deviceLabelFor(r: (typeof requests)[number]) {
    const brand = lookups.find((l) => l.id === r.deviceBrandId);
    const model = deviceModels.find((m) => m.id === r.deviceModelId);
    return brand ? `${brand.label} ${model?.name ?? ""}`.trim() : r.deviceOther || "—";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Repair by Courier</h1>
        <p className="mt-1 text-sm text-slate-400">Customers shipping their phone to a branch by courier — from shipment to return delivery.</p>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Requests by Status</h3>
        <BarBreakdownChart data={byStatus} emptyMessage="No courier repair requests yet." />
      </div>

      <form className="card flex flex-wrap gap-3">
        <select name="status" defaultValue={sp.status ?? ""} className="input w-full sm:w-48">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="branch" defaultValue={sp.branch ?? ""} className="input w-full sm:w-44">
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary flex-1 sm:flex-none">
          Filter
        </button>
        <Link href="/admin/mail-ins" className="btn-secondary flex-1 text-center sm:flex-none">
          Clear
        </Link>
      </form>

      {/* Mobile: one card per request. */}
      <div className="space-y-3 sm:hidden">
        {requests.length === 0 && <p className="card text-center text-sm text-slate-400">No requests match these filters.</p>}
        {requests.map((r) => (
          <div key={r.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-blue-300">{r.reference}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{r.name}</p>
              </div>
              <StatusBadge label={labelFor(r.statusId, statuses)} />
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-slate-400">Branch</span>
              <span className="text-right text-slate-600">{labelFor(r.branchId, branches)}</span>
              <span className="text-slate-400">Device</span>
              <span className="text-right text-slate-600">{deviceLabelFor(r)}</span>
              <span className="text-slate-400">Tracking</span>
              <span className="text-right text-slate-600">{r.outboundTracking || "—"}</span>
            </div>
            <Link href={`/admin/mail-ins/${r.id}`} className="btn-secondary block text-center !py-1.5 text-xs">
              View
            </Link>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2 pr-3">Device</th>
              <th className="pb-2 pr-3">Inbound Tracking</th>
              <th className="pb-2 pr-3">Submitted</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-400">
                  No requests match these filters.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">{r.reference}</td>
                <td className="py-3 pr-3 text-slate-800">{r.name}</td>
                <td className="py-3 pr-3 text-slate-500">{labelFor(r.branchId, branches)}</td>
                <td className="py-3 pr-3 text-slate-500">{deviceLabelFor(r)}</td>
                <td className="py-3 pr-3 text-slate-500">{r.outboundTracking ? `${r.outboundCourier} · ${r.outboundTracking}` : "—"}</td>
                <td className="py-3 pr-3 text-slate-500">{formatDate(r.createdAt)}</td>
                <td className="py-3 pr-3">
                  <StatusBadge label={labelFor(r.statusId, statuses)} />
                </td>
                <td className="py-3">
                  <Link href={`/admin/mail-ins/${r.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

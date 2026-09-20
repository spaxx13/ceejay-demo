import Link from "next/link";
import { redirect } from "next/navigation";
import { getLookups, getBranches, getDeviceModels, getWalkInRequests, canManageWalkIns, canDeleteHomeServiceRequests, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import DeleteButton from "@/components/DeleteButton";
import BarBreakdownChart from "@/components/BarBreakdownChart";
import { deleteWalkInRequest } from "@/lib/actions";
import { formatDate, todayDateStr } from "@/lib/format";

export default async function WalkInsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string; date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canManageWalkIns(user)) redirect("/admin");

  const sp = await searchParams;
  const [lookups, branches, deviceModels, allRequests] = await Promise.all([getLookups(), getBranches(), getDeviceModels(), getWalkInRequests()]);
  const statuses = lookups.filter((l) => l.kind === "walkin_status").sort((a, b) => a.order - b.order);

  // Branch scoping — a branch admin only sees walk-in registrations for
  // their own assigned branch(es), same pattern as Home Service Requests'
  // queue scoping.
  const visibleRequests = allRequests.filter((r) => !isBranchHidden(user, r.branchId));

  let requests = [...visibleRequests];
  if (sp.status) requests = requests.filter((r) => r.statusId === sp.status);
  if (sp.branch) requests = requests.filter((r) => r.branchId === sp.branch);
  if (sp.date) requests = requests.filter((r) => r.preferredDate === sp.date);
  requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const todayStr = todayDateStr();
  const isShowingToday = sp.date === todayStr;
  const requestsByStatus = statuses.map((s) => ({ label: s.label, value: visibleRequests.filter((r) => r.statusId === s.id).length }));

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

  function qs(params: Record<string, string | undefined>) {
    const merged = { ...sp, ...params };
    const usp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) usp.set(k, v);
    });
    const s = usp.toString();
    return s ? `?${s}` : "";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Walk-In Registrations</h1>
          <p className="mt-1 text-sm text-slate-400">Customers who pre-registered online that they're bringing their device into a branch.</p>
        </div>
        <Link href={qs({ date: isShowingToday ? undefined : todayStr })} className={isShowingToday ? "btn-primary" : "btn-secondary"}>
          {isShowingToday ? "Showing Today" : "Today"}
        </Link>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Walk-Ins by Status</h3>
        <BarBreakdownChart data={requestsByStatus} emptyMessage="No walk-in registrations yet." />
      </div>

      <form className="card flex flex-wrap gap-3">
        <select name="status" defaultValue={sp.status ?? ""} className="input w-full sm:w-44">
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
        <input type="date" name="date" defaultValue={sp.date ?? ""} className="input w-full sm:w-44" />
        <button type="submit" className="btn-secondary flex-1 sm:flex-none">
          Filter
        </button>
        <Link href="/admin/walk-ins" className="btn-secondary flex-1 text-center sm:flex-none">
          Clear
        </Link>
      </form>

      {/* Mobile: one card per registration. */}
      <div className="space-y-3 sm:hidden">
        {requests.length === 0 && <p className="card text-center text-sm text-slate-400">No walk-in registrations match these filters.</p>}
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
              <span className="text-slate-400">Visit Date</span>
              <span className="text-right text-slate-600">{r.preferredDate ? formatDate(r.preferredDate) : "—"}</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              <Link href={`/admin/walk-ins/${r.id}`} className="btn-secondary flex-1 text-center !py-1.5 text-xs">
                View
              </Link>
              {canDeleteHomeServiceRequests(user) && (
                <DeleteButton
                  id={r.id}
                  action={deleteWalkInRequest}
                  confirmMessage={`Move walk-in registration ${r.reference} to Trash? You can restore it later from Trash.`}
                  label="Move to Trash"
                  className="btn-secondary !py-1.5 text-xs !text-red-600"
                />
              )}
            </div>
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
              <th className="pb-2 pr-3">Visit Date</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No walk-in registrations match these filters.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">{r.reference}</td>
                <td className="py-3 pr-3 text-slate-800">{r.name}</td>
                <td className="py-3 pr-3 text-slate-500">{labelFor(r.branchId, branches)}</td>
                <td className="py-3 pr-3 text-slate-500">{deviceLabelFor(r)}</td>
                <td className="py-3 pr-3 text-slate-500">{r.preferredDate ? formatDate(r.preferredDate) : "—"}</td>
                <td className="py-3 pr-3">
                  <StatusBadge label={labelFor(r.statusId, statuses)} />
                </td>
                <td className="py-3">
                  <div className="flex gap-1.5">
                    <Link href={`/admin/walk-ins/${r.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                      View
                    </Link>
                    {canDeleteHomeServiceRequests(user) && (
                      <DeleteButton
                        id={r.id}
                        action={deleteWalkInRequest}
                        confirmMessage={`Move walk-in registration ${r.reference} to Trash? You can restore it later from Trash.`}
                        label="Move to Trash"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getLookups, getTechnicians, getRequests, canManageHomeServiceRequests, canDeleteHomeServiceRequests, isBranchHidden } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import DeleteButton from "@/components/DeleteButton";
import { deleteHomeServiceRequest } from "@/lib/actions";
import { formatDate, todayDateStr } from "@/lib/format";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; technician?: string; date?: string; unassigned?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) redirect("/admin");

  const sp = await searchParams;
  const [lookups, technicians, allRequests] = await Promise.all([getLookups(), getTechnicians(), getRequests()]);
  const statuses = lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);

  // Queue scoping — a branch admin assigned to only one queue's backend
  // branch never sees the other queue's requests here, even via filters.
  const visibleRequests = allRequests.filter((r) => !isBranchHidden(user, r.queueBranchId));

  // A request still awaiting the customer's confirmation-email click isn't
  // actually assignable yet, so it's excluded from "unassigned" here —
  // matches the Dashboard's Unassigned Queue stat.
  const pendingConfirmationStatusId = statuses.find((s) => s.label === "Pending Confirmation")?.id;
  const isUnassigned = (r: (typeof visibleRequests)[number]) => !r.assignedTechnicianId && r.statusId !== pendingConfirmationStatusId;

  let requests = [...visibleRequests];
  if (sp.status) requests = requests.filter((r) => r.statusId === sp.status);
  if (sp.technician) requests = requests.filter((r) => r.assignedTechnicianId === sp.technician);
  if (sp.date) requests = requests.filter((r) => r.preferredDatetime.startsWith(sp.date!));
  if (sp.unassigned === "1") requests = requests.filter(isUnassigned);
  requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const unassignedCount = visibleRequests.filter(isUnassigned).length;
  const todayStr = todayDateStr();
  const isShowingToday = sp.date === todayStr;

  // Total assigned requests per technician, regardless of the current
  // filters — lets the admin spot technicians who haven't been handed
  // any request yet (count of 0) alongside everyone else's load.
  const technicianCounts = technicians
    .map((t) => ({ id: t.id, name: t.name, count: visibleRequests.filter((r) => r.assignedTechnicianId === t.id).length }))
    .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));

  function labelFor(id: string | null, list: { id: string; label?: string; name?: string }[]) {
    if (!id) return "—";
    const found = list.find((x) => x.id === id);
    return found?.label ?? found?.name ?? "—";
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
          <h1 className="text-xl font-bold text-slate-900">Home Service Requests</h1>
          <p className="mt-1 text-sm text-slate-400">List, filter, and manage requests. Unassigned requests need manual assignment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={qs({ date: isShowingToday ? undefined : todayStr })} className={isShowingToday ? "btn-primary" : "btn-secondary"}>
            {isShowingToday ? "Showing Today" : "Today"}
          </Link>
          <Link href={qs({ unassigned: sp.unassigned === "1" ? undefined : "1" })} className={sp.unassigned === "1" ? "btn-primary" : "btn-secondary"}>
            {sp.unassigned === "1" ? "Showing Unassigned" : `Unassigned Queue (${unassignedCount})`}
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-700">Technician Workload</h2>
        <p className="mt-1 text-xs text-slate-400">Total requests assigned per technician — a count of 0 means they haven&apos;t been assigned anything yet.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {technicianCounts.map((t) => (
            <span
              key={t.id}
              className={`rounded-full border px-3 py-1 text-xs ${
                t.count === 0 ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {t.name}: {t.count}
            </span>
          ))}
        </div>
      </div>

      <form className="card flex flex-wrap gap-3">
        <select name="status" defaultValue={sp.status ?? ""} className="input w-44">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="technician" defaultValue={sp.technician ?? ""} className="input w-44">
          <option value="">All technicians</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input type="date" name="date" defaultValue={sp.date ?? ""} className="input w-44" />
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        <Link href="/admin/requests" className="btn-secondary">
          Clear
        </Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Technician</th>
              <th className="pb-2 pr-3">Preferred</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No requests match these filters.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">{r.reference}</td>
                <td className="py-3 pr-3 text-slate-800">{r.customerName}</td>
                <td className="py-3 pr-3 text-slate-500">{r.assignedTechnicianId ? labelFor(r.assignedTechnicianId, technicians) : <span className="text-amber-700">Unassigned</span>}</td>
                <td className="py-3 pr-3 text-slate-500">{formatDate(r.preferredDatetime)}</td>
                <td className="py-3 pr-3">
                  <StatusBadge label={labelFor(r.statusId, statuses)} />
                </td>
                <td className="py-3">
                  <div className="flex gap-1.5">
                    <Link href={`/admin/requests/${r.id}`} className="btn-secondary !px-3 !py-1 text-xs">
                      View
                    </Link>
                    {canDeleteHomeServiceRequests(user) && (
                      <DeleteButton
                        id={r.id}
                        action={deleteHomeServiceRequest}
                        confirmMessage={`Permanently delete home service request ${r.reference}? This can't be undone.`}
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

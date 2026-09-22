import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getLookups,
  getTechnicians,
  getBranches,
  getRequests,
  getDeviceModels,
  getServiceAgreements,
  homeServiceSalesByTechnician,
  sumHomeServiceSales,
  canManageHomeServiceRequests,
  canDeleteHomeServiceRequests,
  isBranchHidden,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import DeleteButton from "@/components/DeleteButton";
import BarBreakdownChart from "@/components/BarBreakdownChart";
import RequestsFilterForm from "@/components/RequestsFilterForm";
import { deleteHomeServiceRequest } from "@/lib/actions";
import { formatDate, todayDateStr } from "@/lib/format";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; technician?: string; date?: string; unassigned?: string; province?: string }>;
}) {
  const user = await getCurrentUser();
  if (!canManageHomeServiceRequests(user)) redirect("/admin");

  const sp = await searchParams;
  const [lookups, technicians, branches, allRequests, deviceModels, agreements] = await Promise.all([
    getLookups(),
    getTechnicians(),
    getBranches(),
    getRequests(),
    getDeviceModels(),
    getServiceAgreements(),
  ]);
  const statuses = lookups.filter((l) => l.kind === "request_status").sort((a, b) => a.order - b.order);

  // A "home service technician" is one whose branch assignment includes an
  // address-less branch — the near/far home-service queues — same signal
  // already used to gate the technician dropdown on the request detail page.
  // Branch-only/POS technicians never get one of those, so they're excluded
  // here rather than cluttering the list with people who don't do home visits.
  const homeServiceBranchIds = branches.filter((b) => !b.address).map((b) => b.id);
  const homeServiceTechnicians = technicians.filter((t) => t.active && t.branchIds.some((id) => homeServiceBranchIds.includes(id)));

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
  if (sp.province) requests = requests.filter((r) => r.province === sp.province);
  if (sp.unassigned === "1") requests = requests.filter(isUnassigned);
  requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Every province actually seen on a request — not just the shop's current
  // serviceable list (lib/homeServiceFees.ts), since an older request can
  // carry a province (e.g. Quezon) that's since been dropped from the
  // public picker but still needs to show up here.
  const provinceOptions = Array.from(new Set(visibleRequests.map((r) => r.province).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  // Technician breakdown for whatever's currently filtered — most useful
  // paired with the province dropdown ("who's covering this province, and
  // how many"), but reflects every active filter (date, status, etc.) too.
  const filteredTechnicianCounts =
    sp.province || sp.date
      ? Array.from(
          requests.reduce((map, r) => {
            const name = r.assignedTechnicianId ? (technicians.find((t) => t.id === r.assignedTechnicianId)?.name ?? "—") : "Unassigned";
            map.set(name, (map.get(name) ?? 0) + 1);
            return map;
          }, new Map<string, number>())
        )
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      : [];

  const unassignedCount = visibleRequests.filter(isUnassigned).length;
  // How many requests share each booking_group_id — a count > 1 means
  // several devices from the same "+ Add Another Device" submission (same
  // visit, same address), shown as a small badge next to the reference.
  const groupCounts = new Map<string, number>();
  for (const r of visibleRequests) {
    if (!r.bookingGroupId) continue;
    groupCounts.set(r.bookingGroupId, (groupCounts.get(r.bookingGroupId) ?? 0) + 1);
  }
  const todayStr = todayDateStr();
  const isShowingToday = sp.date === todayStr;

  const requestsByStatus = statuses.map((s) => ({ label: s.label, value: visibleRequests.filter((r) => r.statusId === s.id).length }));

  // Today's assigned requests per home service technician — scoped to today
  // (not the whole backlog) so this answers "who's covered for today" and
  // "who's still free today," not a lifetime tally.
  const todaysRequests = visibleRequests.filter((r) => r.preferredDatetime.startsWith(todayStr));
  const technicianCounts = homeServiceTechnicians
    .map((t) => ({ id: t.id, name: t.name, count: todaysRequests.filter((r) => r.assignedTechnicianId === t.id).length }))
    .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));

  // Same 30/70 split as Sales > Home Service, scoped to today only — a
  // quick "how are we doing" summary so this page doesn't need its own
  // date-range picker; the full breakdown is still one click away there.
  const salesRows = homeServiceSalesByTechnician(agreements, (date) => date === todayStr, allRequests);
  const salesTotal = sumHomeServiceSales(salesRows);

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
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Requests by Status</h3>
        <BarBreakdownChart data={requestsByStatus} emptyMessage="No requests yet." />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Technician Workload — Today</h2>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Total Home Service Today: {todaysRequests.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Requests assigned per home service technician for today — a count of 0 means they haven&apos;t been assigned anything yet. Click a name to see
          their list below.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {technicianCounts.map((t) => {
            const active = sp.technician === t.id && sp.date === todayStr;
            return (
              <Link
                key={t.id}
                href={qs({ technician: active ? undefined : t.id, date: active ? undefined : todayStr, unassigned: undefined })}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-blue-300 bg-blue-100 text-blue-700"
                    : t.count === 0
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.name}: {t.count}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Home Service Sales — Today</h3>
            <p className="mt-0.5 text-xs text-slate-400">Completed jobs only, same 30/70 split as the full Sales report.</p>
          </div>
          <Link href="/admin/sales/home-service" className="text-xs text-blue-300 hover:underline">
            View full report →
          </Link>
        </div>
        {salesRows.length === 0 ? (
          <p className="text-sm text-slate-400">No home service jobs completed yet today.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {salesRows.map((r) => (
                <span
                  key={r.name}
                  className={`rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 ${r.name === "Unassigned" ? "opacity-60" : ""}`}
                >
                  {r.name}: {peso(r.totalAmount)}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-100 pt-3">
              <div>
                <p className="text-xs text-slate-400">
                  Total Amount ({salesTotal.count} job{salesTotal.count === 1 ? "" : "s"})
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{peso(salesTotal.totalAmount)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border-2 border-green-300 bg-green-50 px-3 py-2">
                <span className="text-xs font-semibold text-green-900">Company Share (30%)</span>
                <span className="break-all text-lg font-bold text-green-900">{peso(salesTotal.companyShare)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <RequestsFilterForm statuses={statuses} technicians={homeServiceTechnicians} provinces={provinceOptions} current={sp} />

      {(sp.date || sp.province || sp.status || sp.technician || sp.unassigned === "1") && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              {requests.length} job{requests.length === 1 ? "" : "s"}
              {sp.date && <> on {formatDate(sp.date)}</>}
              {sp.province && <> in {sp.province}</>}
            </p>
          </div>
          {filteredTechnicianCounts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredTechnicianCounts.map((t) => (
                <span
                  key={t.name}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    t.name === "Unassigned" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {t.name}: {t.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile: one card per request — a 7-column table (with a Delete
          button in the last column) doesn't fit a phone screen without
          horizontal scroll, so this reflows the same fields as a stacked
          summary instead. */}
      <div className="space-y-3 sm:hidden">
        {requests.length === 0 && <p className="card text-center text-sm text-slate-400">No requests match these filters.</p>}
        {requests.map((r) => (
          <div key={r.id} className="card space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-blue-300">
                  {r.reference}
                  {r.bookingGroupId && (groupCounts.get(r.bookingGroupId) ?? 0) > 1 && (
                    <span
                      className="ml-1.5 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-blue-700"
                      title={`Part of a ${groupCounts.get(r.bookingGroupId)}-device booking — same visit, same address`}
                    >
                      🔗 {groupCounts.get(r.bookingGroupId)}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{r.customerName}</p>
              </div>
              <StatusBadge label={labelFor(r.statusId, statuses)} />
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-slate-400">Device</span>
              <span className="text-right text-slate-600">
                {deviceLabelFor(r)}
                <span className="block text-slate-400">{labelFor(r.serviceTypeId, lookups)}</span>
              </span>
              <span className="text-slate-400">Location</span>
              <span className="text-right text-slate-600">{[r.city, r.province].filter(Boolean).join(", ") || "—"}</span>
              <span className="text-slate-400">Technician</span>
              <span className={r.assignedTechnicianId ? "text-right text-slate-600" : "text-right text-amber-700"}>
                {r.assignedTechnicianId ? labelFor(r.assignedTechnicianId, technicians) : "Unassigned"}
              </span>
              <span className="text-slate-400">Preferred</span>
              <span className="text-right text-slate-600">{formatDate(r.preferredDatetime)}</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              <Link href={`/admin/requests/${r.id}`} className="btn-secondary flex-1 text-center !py-1.5 text-xs">
                View
              </Link>
              {canDeleteHomeServiceRequests(user) && (
                <DeleteButton
                  id={r.id}
                  action={deleteHomeServiceRequest}
                  confirmMessage={`Move home service request ${r.reference} to Trash? You can restore it later from Trash.`}
                  label="Move to Trash"
                  className="btn-secondary !py-1.5 text-xs !text-red-600"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table, same fields. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Device</th>
              <th className="pb-2 pr-3">Location</th>
              <th className="pb-2 pr-3">Technician</th>
              <th className="pb-2 pr-3">Preferred</th>
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
                <td className="py-3 pr-3 font-mono text-xs text-blue-300">
                  {r.reference}
                  {r.bookingGroupId && (groupCounts.get(r.bookingGroupId) ?? 0) > 1 && (
                    <span
                      className="ml-1.5 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-blue-700"
                      title={`Part of a ${groupCounts.get(r.bookingGroupId)}-device booking — same visit, same address`}
                    >
                      🔗 {groupCounts.get(r.bookingGroupId)}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3 text-slate-800">{r.customerName}</td>
                <td className="py-3 pr-3 text-slate-500">
                  {deviceLabelFor(r)}
                  <span className="block text-xs text-slate-400">{labelFor(r.serviceTypeId, lookups)}</span>
                </td>
                <td className="py-3 pr-3 text-slate-500">{[r.city, r.province].filter(Boolean).join(", ") || "—"}</td>
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
                        confirmMessage={`Move home service request ${r.reference} to Trash? You can restore it later from Trash.`}
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

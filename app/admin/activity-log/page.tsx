import Link from "next/link";
import { redirect } from "next/navigation";
import { getActivity } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import { formatDateTime, todayDateStr, toManilaDateStr } from "@/lib/format";
import type { ActivityLog } from "@/lib/types";

const ENTITY_LABELS: Record<ActivityLog["entityType"], string> = {
  customer: "Customer",
  lead: "Lead",
  home_service_request: "Home Service Request",
  walkin_request: "Walk-In Request",
  manual_checklist: "Manual Checklist",
  branch: "Branch",
  technician: "Technician",
  rider: "Rider",
  user: "Staff Account",
  catalog: "Catalog / Pricing",
  site_content: "Site Content",
  repair_record: "POS Ticket",
  expense: "Expense",
  icloud_check: "iCloud Check",
};

// Every admin-attributable action across the site, in one place — owner
// only. Sourced from the same activity_log table each individual record's
// own detail page already reads from (logActivity(), lib/db.ts), just
// unfiltered by entity here instead of scoped to one record. Deliberately
// excludes a few things that already have their own dedicated audit trail
// or view: staff logins (Login Logs), technician/branch check-ins
// (Check-Ins), and CRM broadcasts (Admin > CRM > Broadcast, which already
// records subject/recipients/sent count per send — a generic log line here
// would just be a weaker duplicate). Purely cosmetic reordering (arrow
// buttons on lookups/custom fields) isn't logged either — there's no
// decision there worth auditing, just a display order.
export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entityType?: string; from?: string; to?: string }>;
}) {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const sp = await searchParams;
  const allLogs = await getActivity();

  let logs = [...allLogs];
  if (sp.entityType) logs = logs.filter((l) => l.entityType === sp.entityType);
  if (sp.from) logs = logs.filter((l) => toManilaDateStr(l.at) >= sp.from!);
  if (sp.to) logs = logs.filter((l) => toManilaDateStr(l.at) <= sp.to!);
  if (sp.q) {
    const q = sp.q.toLowerCase();
    logs = logs.filter((l) => l.actor.toLowerCase().includes(q) || l.message.toLowerCase().includes(q));
  }

  const today = todayDateStr();
  const todayLogs = allLogs.filter((l) => toManilaDateStr(l.at) === today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Activity Log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything admin/staff accounts have done across the site — who, what, and when. Search by staff name or filter by area below.
        </p>
      </div>

      <SettingsTabs />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-400">Actions Today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{todayLogs.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Staff Active Today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{new Set(todayLogs.map((l) => l.actor)).size}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Total Logged Actions</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{allLogs.length}</p>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">Search</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Staff name or keyword..." className="input w-full sm:w-56" />
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">Area</label>
          <select name="entityType" defaultValue={sp.entityType ?? ""} className="input w-full sm:w-48">
            <option value="">All areas</option>
            {(Object.entries(ENTITY_LABELS) as [ActivityLog["entityType"], string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="input w-full sm:w-44" />
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="input w-full sm:w-44" />
        </div>
        <button type="submit" className="btn-secondary flex-1 sm:flex-none">
          Filter
        </button>
        <Link href="/admin/activity-log" className="btn-secondary flex-1 text-center sm:flex-none">
          Clear
        </Link>
      </form>

      {/* Mobile: one card per entry. */}
      <div className="space-y-2 sm:hidden">
        {logs.length === 0 && <p className="card text-center text-sm text-slate-400">No activity recorded for this filter.</p>}
        {logs.map((l) => (
          <div key={l.id} className="card space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{l.actor}</p>
              <span className="badge shrink-0 border border-slate-300 bg-slate-100 text-[10px] text-slate-500">{ENTITY_LABELS[l.entityType]}</span>
            </div>
            <p className="text-sm text-slate-600">{l.message}</p>
            <p className="text-xs text-slate-400">{formatDateTime(l.at)}</p>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Staff</th>
              <th className="pb-2 pr-3">Area</th>
              <th className="pb-2 pr-3">What Happened</th>
              <th className="pb-2">Date &amp; Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  No activity recorded for this filter.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800 whitespace-nowrap">{l.actor}</td>
                <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">{ENTITY_LABELS[l.entityType]}</td>
                <td className="py-3 pr-3 text-slate-600">{l.message}</td>
                <td className="py-3 text-slate-500 whitespace-nowrap">{formatDateTime(l.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

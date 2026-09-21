import Link from "next/link";
import { redirect } from "next/navigation";
import { getCheckIns } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import { formatDateTime } from "@/lib/format";
import type { Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  owner_admin: "Owner Admin",
  branch_admin: "Branch Admin",
  technician: "Technician",
};

export default async function CheckInsPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; from?: string; to?: string }> }) {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const sp = await searchParams;
  const allCheckIns = await getCheckIns();

  let checkIns = [...allCheckIns];
  if (sp.role) checkIns = checkIns.filter((c) => c.role === sp.role);
  if (sp.from) checkIns = checkIns.filter((c) => c.checkedInAt.slice(0, 10) >= sp.from!);
  if (sp.to) checkIns = checkIns.filter((c) => c.checkedInAt.slice(0, 10) <= sp.to!);
  if (sp.q) {
    const q = sp.q.toLowerCase();
    checkIns = checkIns.filter((c) => c.userName.toLowerCase().includes(q) || c.branchName.toLowerCase().includes(q));
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayCheckIns = allCheckIns.filter((c) => c.checkedInAt.slice(0, 10) === today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Check-Ins</h1>
        <p className="mt-1 text-sm text-slate-400">
          When a technician or branch admin marked themselves as checked in at a branch — separate from Login Logs, which fires on every login.
        </p>
      </div>

      <SettingsTabs />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-400">Checked In Today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{todayCheckIns.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Total Check-Ins (All-Time)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{allCheckIns.length}</p>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">Search</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or branch..." className="input w-full sm:w-56" />
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">Role</label>
          <select name="role" defaultValue={sp.role ?? ""} className="input w-full sm:w-40">
            <option value="">All roles</option>
            <option value="branch_admin">Branch Admin</option>
            <option value="technician">Technician</option>
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
        <Link href="/admin/check-ins" className="btn-secondary flex-1 text-center sm:flex-none">
          Clear
        </Link>
      </form>

      {/* Mobile: one card per check-in — a 4-column table doesn't fit a phone screen. */}
      <div className="space-y-3 sm:hidden">
        {checkIns.length === 0 && <p className="card text-center text-sm text-slate-400">No check-ins recorded for this filter.</p>}
        {checkIns.map((c) => (
          <div key={c.id} className="card space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{c.userName}</p>
              <span className="shrink-0 text-xs text-slate-500">{ROLE_LABELS[c.role]}</span>
            </div>
            <p className="text-xs text-slate-500">{c.branchName}</p>
            <p className="text-xs text-slate-400">{formatDateTime(c.checkedInAt)}</p>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table, same fields. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Staff</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2 pr-3">Branch</th>
              <th className="pb-2">Date &amp; Time</th>
            </tr>
          </thead>
          <tbody>
            {checkIns.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  No check-ins recorded for this filter.
                </td>
              </tr>
            )}
            {checkIns.map((c) => (
              <tr key={c.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{c.userName}</td>
                <td className="py-3 pr-3 text-slate-500">{ROLE_LABELS[c.role]}</td>
                <td className="py-3 pr-3 text-slate-500">{c.branchName}</td>
                <td className="py-3 text-slate-500">{formatDateTime(c.checkedInAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

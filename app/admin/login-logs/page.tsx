import Link from "next/link";
import { redirect } from "next/navigation";
import { getLoginLogs } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import SettingsTabs from "@/components/SettingsTabs";
import { formatDateTime } from "@/lib/format";
import type { Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  owner_admin: "Owner Admin",
  branch_admin: "Branch Admin",
  technician: "Technician",
};

export default async function LoginLogsPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; from?: string; to?: string }> }) {
  if (!(await requireRole("owner_admin"))) redirect("/admin");

  const sp = await searchParams;
  const allLogs = await getLoginLogs();

  let logs = [...allLogs];
  if (sp.role) logs = logs.filter((l) => l.role === sp.role);
  if (sp.from) logs = logs.filter((l) => l.at.slice(0, 10) >= sp.from!);
  if (sp.to) logs = logs.filter((l) => l.at.slice(0, 10) <= sp.to!);
  if (sp.q) {
    const q = sp.q.toLowerCase();
    logs = logs.filter((l) => l.userName.toLowerCase().includes(q) || l.userEmail.toLowerCase().includes(q));
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = allLogs.filter((l) => l.at.slice(0, 10) === today);
  const uniqueStaffToday = new Set(todayLogs.map((l) => l.userId ?? l.userEmail)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Login Logs</h1>
        <p className="mt-1 text-sm text-slate-400">Every successful staff login, with date and time — use this to check who&apos;s actually signing in.</p>
      </div>

      <SettingsTabs />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-400">Logins Today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{todayLogs.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Unique Staff Today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{uniqueStaffToday}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Total Logins (All-Time)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{allLogs.length}</p>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-3">
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">Search</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or email..." className="input w-full sm:w-56" />
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <label className="text-xs font-medium text-slate-500">Role</label>
          <select name="role" defaultValue={sp.role ?? ""} className="input w-full sm:w-40">
            <option value="">All roles</option>
            <option value="owner_admin">Owner Admin</option>
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
        <Link href="/admin/login-logs" className="btn-secondary flex-1 text-center sm:flex-none">
          Clear
        </Link>
      </form>

      {/* Mobile: one card per login — a 4-column table with full email
          addresses still doesn't fit a phone screen. */}
      <div className="space-y-3 sm:hidden">
        {logs.length === 0 && <p className="card text-center text-sm text-slate-400">No logins recorded for this filter.</p>}
        {logs.map((l) => (
          <div key={l.id} className="card space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{l.userName}</p>
              <span className="shrink-0 text-xs text-slate-500">{ROLE_LABELS[l.role]}</span>
            </div>
            <p className="text-xs text-slate-500 break-all">{l.userEmail}</p>
            <p className="text-xs text-slate-400">{formatDateTime(l.at)}</p>
          </div>
        ))}
      </div>

      {/* Desktop/tablet: full table, same fields. */}
      <div className="hidden card overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Staff</th>
              <th className="pb-2 pr-3">Email</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2">Date &amp; Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  No logins recorded for this filter.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{l.userName}</td>
                <td className="py-3 pr-3 text-slate-500">{l.userEmail}</td>
                <td className="py-3 pr-3 text-slate-500">{ROLE_LABELS[l.role]}</td>
                <td className="py-3 text-slate-500">{formatDateTime(l.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

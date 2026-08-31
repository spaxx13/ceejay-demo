import Link from "next/link";
import { store } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  const totalRequests = store.requests.length;
  const unassigned = store.requests.filter((r) => !r.assignedTechnicianId);
  const unzoned = store.requests.filter((r) => r.unzoned).length;
  const activeZones = store.zones.filter((z) => z.active).length;
  const activeTechs = store.technicians.filter((t) => t.active).length;
  const totalLeads = store.leads.length;
  const totalCustomers = store.customers.length;
  const statuses = store.lookups.filter((l) => l.kind === "request_status");

  const today = new Date().toISOString().slice(0, 10);
  const todaySales = store.sales.filter((s) => s.createdAt.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const lowStock = store.inventory.filter((i) => i.active && i.quantityOnHand <= i.reorderLevel).length;

  const recent = [...store.requests].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6);

  const stats = [
    { label: "Today's Revenue", value: `₱${todayRevenue.toLocaleString()}`, href: "/admin/pos" },
    { label: "Today's Sales", value: todaySales.length, href: "/admin/pos" },
    { label: "Low Stock Items", value: lowStock, href: "/admin/inventory", warn: lowStock > 0 },
    { label: "Home Service Requests", value: totalRequests, href: "/admin/requests" },
    { label: "Unassigned Queue", value: unassigned.length, href: "/admin/requests?unassigned=1", warn: unassigned.length > 0 },
    { label: "Unzoned Requests", value: unzoned, href: "/admin/requests", warn: unzoned > 0 },
    { label: "Active Zones", value: activeZones, href: "/admin/zones", ownerOnly: true },
    { label: "Active Technicians", value: activeTechs, href: "/admin/technicians", ownerOnly: true },
    { label: "Leads", value: totalLeads, href: "/admin/crm" },
    { label: "Customers", value: totalCustomers, href: "/admin/crm" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Overview of home service operations.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) =>
          s.ownerOnly && user?.role !== "owner_admin" ? (
            <div key={s.label} className="card">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          ) : (
            <Link key={s.label} href={s.href} className="card block hover:border-blue-300">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.warn ? "text-amber-700" : "text-slate-900"}`}>{s.value}</p>
            </Link>
          )
        )}
      </div>

      {user?.role === "owner_admin" && (
        <Link href="/admin/settings" className="card flex items-center justify-between hover:border-blue-300">
          <div>
            <p className="text-sm font-semibold text-slate-800">Settings</p>
            <p className="mt-0.5 text-xs text-slate-400">Branches, Zones, Technicians, Catalog, Statuses, and public site content.</p>
          </div>
          <span className="text-sm text-blue-300">Configure →</span>
        </Link>
      )}

      <div className="card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Recent Requests</h3>
          <Link href="/admin/requests" className="text-xs text-blue-300 hover:underline">
            View all →
          </Link>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Reference</th>
              <th className="pb-2 pr-3">Customer</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  No requests yet. Submit one from the public form to see it here.
                </td>
              </tr>
            )}
            {recent.map((r) => {
              const status = statuses.find((s) => s.id === r.statusId);
              return (
                <tr key={r.id} className="border-b border-slate-200 last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link href={`/admin/requests/${r.id}`} className="font-mono text-xs text-blue-300 hover:underline">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-800">{r.customerName}</td>
                  <td className="py-2.5 pr-3">{status && <StatusBadge label={status.label} />}</td>
                  <td className="py-2.5 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

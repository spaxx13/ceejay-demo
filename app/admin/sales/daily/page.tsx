import Link from "next/link";
import { getRepairRecords, getTechnicians, isBranchHidden, technicianSharePercent } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SalesTabs from "@/components/SalesTabs";

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function DailySalesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const [user, repairRecords, technicians] = await Promise.all([getCurrentUser(), getRepairRecords(), getTechnicians()]);

  const inRange = (date: string) => (!sp.from || date >= sp.from) && (!sp.to || date <= sp.to);

  // Same source and formula as Branch Sales — POS repair records only, each
  // technician's Net Profit split by their own earnings share. Bucketed by
  // day instead of branch, but built the same bottom-up way: every day's
  // Technician Share and Remaining are just the sum of that day's
  // technicians' rows, so they always add back up to Net Profit exactly.
  // Home service earnings are tracked separately — see the Home Service tab.
  const posSales = repairRecords.filter((r) => !r.cancelled && inRange(r.serviceDate) && !isBranchHidden(user, r.branchId));

  type TechBucket = { name: string; revenue: number; jobCost: number };
  const dayTechs = new Map<string, Map<string, TechBucket>>();
  const ensureTech = (date: string, rawName: string) => {
    const name = rawName.trim() || "Unassigned";
    if (!dayTechs.has(date)) dayTechs.set(date, new Map());
    const dayMap = dayTechs.get(date)!;
    if (!dayMap.has(name)) dayMap.set(name, { name, revenue: 0, jobCost: 0 });
    return dayMap.get(name)!;
  };
  const dayCounts = new Map<string, number>();

  for (const r of posSales) {
    const t = ensureTech(r.serviceDate, r.technicianName);
    t.revenue += r.cost;
    t.jobCost += r.partsCost + r.laborCost + r.otherExpenses;
    dayCounts.set(r.serviceDate, (dayCounts.get(r.serviceDate) ?? 0) + 1);
  }

  const rows = Array.from(dayTechs.entries())
    .map(([date, techMap]) => {
      const totals = Array.from(techMap.values()).reduce(
        (acc, t) => {
          const netProfit = t.revenue - t.jobCost;
          const sharePercent = technicianSharePercent(t.name, technicians);
          const share = sharePercent >= 100 ? 0 : netProfit * (sharePercent / 100);
          const remaining = netProfit - share;
          return {
            revenue: acc.revenue + t.revenue,
            jobCost: acc.jobCost + t.jobCost,
            netProfit: acc.netProfit + netProfit,
            technicianShare: acc.technicianShare + share,
            remaining: acc.remaining + remaining,
          };
        },
        { revenue: 0, jobCost: 0, netProfit: 0, technicianShare: 0, remaining: 0 }
      );
      return { date, count: dayCounts.get(date) ?? 0, ...totals };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const grandTotal = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      revenue: acc.revenue + r.revenue,
      jobCost: acc.jobCost + r.jobCost,
      netProfit: acc.netProfit + r.netProfit,
      technicianShare: acc.technicianShare + r.technicianShare,
      remaining: acc.remaining + r.remaining,
    }),
    { count: 0, revenue: 0, jobCost: 0, netProfit: 0, technicianShare: 0, remaining: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Daily Sales</h1>
        <p className="mt-1 text-sm text-slate-400">
          POS revenue broken down by day, across whatever branch(es) this account can access — same figures and formula as Branch Sales, just
          grouped by day. Home service earnings are tracked separately — see the Home Service tab.
        </p>
      </div>

      <SalesTabs />

      <form className="card flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">From</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="input w-44" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">To</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="input w-44" />
        </div>
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        <Link href="/admin/sales/daily" className="btn-secondary">
          Clear
        </Link>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Jobs</th>
              <th className="pb-2 pr-3 font-medium">Total Income</th>
              <th className="pb-2 pr-3 font-medium">Job Costs</th>
              <th className="pb-2 pr-3 font-medium">Net Profit</th>
              <th className="pb-2 pr-3 font-medium">Technician Share</th>
              <th className="pb-2 font-medium">Remaining (Business)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  No sales recorded yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.date} className="border-b border-slate-200 last:border-0">
                <td className="py-3 pr-3 font-medium text-slate-800">{r.date}</td>
                <td className="py-3 pr-3 text-slate-500">{r.count}</td>
                <td className="py-3 pr-3 text-slate-800">{peso(r.revenue)}</td>
                <td className="py-3 pr-3 text-red-700">−{peso(r.jobCost)}</td>
                <td className="py-3 pr-3 font-semibold text-green-700">{peso(r.netProfit)}</td>
                <td className="py-3 pr-3 text-amber-700">{peso(r.technicianShare)}</td>
                <td className="py-3 font-semibold text-blue-300">{peso(r.remaining)}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="font-semibold text-slate-900">
                <td className="pt-3 pr-3">Total</td>
                <td className="pt-3 pr-3">{grandTotal.count}</td>
                <td className="pt-3 pr-3">{peso(grandTotal.revenue)}</td>
                <td className="pt-3 pr-3 text-red-700">−{peso(grandTotal.jobCost)}</td>
                <td className="pt-3 pr-3 text-green-700">{peso(grandTotal.netProfit)}</td>
                <td className="pt-3 pr-3 text-amber-700">{peso(grandTotal.technicianShare)}</td>
                <td className="pt-3 text-blue-300">{peso(grandTotal.remaining)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
